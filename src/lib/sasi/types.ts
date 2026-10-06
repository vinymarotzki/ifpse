/**
 * Subconjunto do payload do webhook SASI (evento "io.sasi.message") — mesmo
 * formato que o cgc-atividades já consome. Tudo opcional de propósito: o corpo
 * vem de um serviço externo e nada aqui pode assumir que um campo chegou.
 */

export interface SasiDataField {
  name?: string;
  title?: string;
  type?: string;
  value?: unknown;
  formattedValue?: string | string[];
}

export interface SasiMessageRaw {
  id?: number;
  uuid?: string;
  text?: string;
  test?: boolean;
  generatedAt?: string;
  channel?: { id?: number; name?: string } | null;
  team?: { id?: number; name?: string } | null;
  dataFields?: SasiDataField[];
  [key: string]: unknown;
}

export interface SasiWebhookEvent {
  type?: string;
  data?: SasiMessageRaw;
}
