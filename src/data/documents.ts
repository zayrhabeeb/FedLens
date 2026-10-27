import type { CountryCode } from '../shared/types';
import type { DocumentAnalysis } from '../nlp/document';
import { store } from './storage';

const KEY = 'documents';
const MAX_DOCUMENTS = 40;
/** Stored text is truncated to keep chrome.storage usage modest. */
const MAX_STORED_CHARS = 60_000;

export async function listDocuments(): Promise<DocumentAnalysis[]> {
  return (await store.get<DocumentAnalysis[]>(KEY)) ?? [];
}

export function latestFor(docs: readonly DocumentAnalysis[], country: CountryCode): DocumentAnalysis | undefined {
  return docs.filter((d) => d.country === country).sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))[0];
}

export async function saveDocument(doc: DocumentAnalysis): Promise<DocumentAnalysis[]> {
  const stored = { ...doc, text: doc.text.slice(0, MAX_STORED_CHARS) };
  const docs = [stored, ...(await listDocuments()).filter((d) => d.id !== doc.id)].slice(0, MAX_DOCUMENTS);
  await store.set(KEY, docs);
  return docs;
}

export async function deleteDocument(id: string): Promise<DocumentAnalysis[]> {
  const docs = (await listDocuments()).filter((d) => d.id !== id);
  await store.set(KEY, docs);
  return docs;
}
