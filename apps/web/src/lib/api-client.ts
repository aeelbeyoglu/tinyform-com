/**
 * TinyForm API Client
 * Handles all communication with the backend API
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

// Types
export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  plan?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Form {
  id: string;
  publicId: string;
  title: string;
  description?: string;
  schema: any;
  settings: any;
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  formId: string;
  data: Record<string, any>;
  createdAt: string;
}

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

class APIClient {
  private token: string | null = null;

  constructor() {
    // Try to load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Unknown error',
        message: response.statusText,
      }));
      console.error('API Error Response:', error);
      throw new APIError(response.status, error.message || error.error || JSON.stringify(error));
    }

    return response.json();
  }

  // Authentication
  async signUp(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.token);
    return response;
  }

  async signIn(data: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/signin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.token);
    return response;
  }

  async signOut(): Promise<void> {
    await this.request('/api/v1/auth/signout', {
      method: 'POST',
    });
    this.setToken(null);
  }

  async getSession(): Promise<{ user: User | null }> {
    return this.request('/api/v1/auth/session');
  }

  // Forms
  async getForms(): Promise<{ forms: Form[]; pagination?: any }> {
    return this.request('/api/v1/forms');
  }

  async getForm(id: string): Promise<{ form: Form }> {
    return this.request(`/api/v1/forms/${id}`);
  }

  async createForm(data: {
    title: string;
    description?: string;
    schema: any;
    settings?: any;
  }): Promise<{ form: Form }> {
    const response = await this.request<Form>('/api/v1/forms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Wrap the response to match expected format
    return { form: response };
  }

  async updateForm(
    id: string,
    data: Partial<Form>
  ): Promise<{ form: Form }> {
    const response = await this.request<Form>(`/api/v1/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { form: response };
  }

  async deleteForm(id: string): Promise<void> {
    await this.request(`/api/v1/forms/${id}`, {
      method: 'DELETE',
    });
  }

  async publishForm(id: string): Promise<{ form: Form; publicUrl?: string }> {
    const response = await this.request<any>(`/api/v1/forms/${id}/publish`, {
      method: 'POST',
    });
    return { form: response, publicUrl: response.publicUrl };
  }

  async duplicateForm(id: string): Promise<{ form: Form }> {
    const response = await this.request<Form>(`/api/v1/forms/${id}/duplicate`, {
      method: 'POST',
    });
    return { form: response };
  }

  async archiveForm(id: string): Promise<{ form: Form }> {
    const response = await this.request<Form>(`/api/v1/forms/${id}/archive`, {
      method: 'POST',
    });
    return { form: response };
  }

  async clearFormCache(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/v1/forms/${id}/clear-cache`, {
      method: 'POST',
    });
  }

  // Public Forms
  async getPublicForm(publicId: string): Promise<any> {
    return this.request(`/api/v1/public/${publicId}`);
  }

  async submitPublicForm(
    publicId: string,
    data: Record<string, any>
  ): Promise<{ success: boolean; message?: string; redirectUrl?: string }> {
    return this.request(`/api/v1/public/${publicId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Submissions
  async getSubmissions(formId: string, params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ submissions: Submission[]; pagination: any }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/api/v1/forms/${formId}/submissions${query}`);
  }

  async deleteSubmission(submissionId: string): Promise<{ success: boolean }> {
    return this.request(`/api/v1/submissions/${submissionId}`, {
      method: 'DELETE',
    });
  }

  async exportSubmissions(
    formId: string,
    format: 'csv' | 'json' = 'json'
  ): Promise<Blob> {
    const response = await fetch(
      `${API_URL}/api/v1/forms/${formId}/submissions/export?format=${format}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new APIError(response.status, 'Export failed');
    }

    return response.blob();
  }

  // Analytics
  async getFormAnalytics(formId: string) {
    return this.request(`/api/v1/analytics/forms/${formId}`);
  }

  async getAnalyticsOverview() {
    return this.request('/api/v1/analytics/overview');
  }

  // User
  async getProfile() {
    return this.request('/api/v1/users/me');
  }

  async updateProfile(data: {
    name?: string;
    bio?: string;
  }) {
    return this.request('/api/v1/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // API Keys
  async getApiKeys() {
    return this.request('/api/v1/users/me/api-keys');
  }

  async createApiKey(name: string) {
    return this.request('/api/v1/users/me/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async revokeApiKey(keyId: string) {
    return this.request(`/api/v1/users/me/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export class for testing or multiple instances
export default APIClient;