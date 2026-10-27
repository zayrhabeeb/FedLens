/**
 * Extract readable text from the active tab for the URL Analyzer. Uses the
 * activeTab grant (given when the user clicks the toolbar button) and falls
 * back to asking for optional host access only when the user requests it.
 */

export interface PageText {
  title: string;
  url: string;
  text: string;
}

/** Runs inside the page. Must be self-contained (it is serialised by scripting API). */
function extractInPage(): PageText {
  const root = document.querySelector('article') ?? document.querySelector('main') ?? document.body;
  const paragraphs = Array.from(root.querySelectorAll('h1, h2, p, li'))
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 40);
  return { title: document.title, url: location.href, text: paragraphs.join('\n').slice(0, 50_000) };
}

export class PageAccessError extends Error {}

export async function extractActiveTab(): Promise<PageText> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new PageAccessError('No active tab found.');
  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractInPage });
    const page = result?.result as PageText | undefined;
    if (!page || page.text.length < 200) throw new PageAccessError('Could not find article text on this page.');
    return page;
  } catch (err) {
    if (err instanceof PageAccessError) throw err;
    throw new PageAccessError(
      'FedLens cannot read this tab. Click the FedLens toolbar button while on the page, or allow page access below.',
    );
  }
}

/** Must be called from a user gesture (button click). */
export function requestPageAccess(): Promise<boolean> {
  return chrome.permissions.request({ origins: ['https://*/*'] });
}
