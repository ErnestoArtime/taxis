import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { createTaxiSupabaseClient, TaxiSupabaseClient } from '@taxi/supabase';
import { TAXI_AUTH_CONFIG, TaxiAuthConfig } from './taxi-auth.config';

export interface AuthUser {
  id: string;
  email?: string;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
}

export interface UserProfile {
  id: string;
  tenantId: string;
  role: 'customer' | 'driver' | 'tenant_admin' | 'platform_admin';
  displayName: string;
  phone?: string;
  avatarUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class TaxiAuthService {
  private config = inject(TAXI_AUTH_CONFIG);
  private supabase: TaxiSupabaseClient = createTaxiSupabaseClient(
    this.config.supabaseUrl,
    this.config.supabasePublishableKey
  );

  private initPromise?: Promise<void>;
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  private currentProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(true);

  currentUser$ = this.currentUserSubject.asObservable();
  currentProfile$ = this.currentProfileSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();

  get client(): TaxiSupabaseClient {
    return this.supabase;
  }

  get userId(): string | undefined {
    return this.currentUserSubject.value?.id;
  }

  get tenantId(): string | undefined {
    return this.currentProfileSubject.value?.tenantId;
  }

  get userRole(): UserProfile['role'] | undefined {
    return this.currentProfileSubject.value?.role;
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    return this.initPromise;
  }

  async ensureInitialized(): Promise<void> {
    await this.init();
  }

  async signInWithEmail(email: string, password: string): Promise<{ profile?: UserProfile; error?: string }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }

    if (!data.user) {
      return { error: 'No se recibio usuario autenticado.' };
    }

    this.currentUserSubject.next(this.mapUser(data.user));
    const profile = await this.loadProfile(data.user.id);
    if (!profile) {
      await this.signOut();
      return { error: 'El usuario no tiene perfil operativo configurado.' };
    }

    return { profile };
  }

  async signUpWithEmail(
    email: string,
    password: string,
    profile: { displayName: string; phone?: string; tenantId: string }
  ): Promise<{ error?: string }> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: profile.displayName,
          phone: profile.phone
        }
      }
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      const { error: profileError } = await this.supabase.from('profiles').insert({
        id: data.user.id,
        tenant_id: profile.tenantId,
        role: 'customer',
        display_name: profile.displayName,
        phone: profile.phone
      });

      if (profileError) {
        return { error: profileError.message };
      }
    }

    return {};
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.currentUserSubject.next(null);
    this.currentProfileSubject.next(null);
  }

  async refreshProfile(): Promise<void> {
    const user = this.currentUserSubject.value;
    if (user) {
      await this.loadProfile(user.id);
    }
  }

  private async initialize(): Promise<void> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session?.user) {
        this.currentUserSubject.next(this.mapUser(session.user));
        await this.loadProfile(session.user.id);
      }

      this.supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          this.currentUserSubject.next(this.mapUser(session.user));
          await this.loadProfile(session.user.id);
        } else {
          this.currentUserSubject.next(null);
          this.currentProfileSubject.next(null);
        }
      });
    } catch {
      this.currentUserSubject.next(null);
      this.currentProfileSubject.next(null);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private async loadProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      this.currentProfileSubject.next(null);
      return null;
    }

    const profile: UserProfile = {
      id: data.id,
      tenantId: data.tenant_id,
      role: data.role,
      displayName: data.display_name,
      phone: data.phone,
      avatarUrl: data.avatar_url
    };
    this.currentProfileSubject.next(profile);
    return profile;
  }

  private mapUser(user: unknown): AuthUser {
    const u = user as {
      id: string;
      email?: string;
      app_metadata: Record<string, unknown>;
      user_metadata: Record<string, unknown>;
    };
    return {
      id: u.id,
      email: u.email,
      appMetadata: u.app_metadata,
      userMetadata: u.user_metadata
    };
  }
}
