import type { ProfileProgressDocument } from './progress.js';

export interface ApiErrorResponse {
  ok: false;
  error: string;
  detail?: string;
}

export interface GetProgressResponse {
  ok: true;
  data: ProfileProgressDocument;
}

export interface PutProgressRequest {
  document: ProfileProgressDocument;
}

export interface PutProgressResponse {
  ok: true;
  data: ProfileProgressDocument;
}

export interface HealthResponse {
  ok: true;
  version: string;
  uptime?: number;
}
