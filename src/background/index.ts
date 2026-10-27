/**
 * Background script. Its only job is wiring the toolbar button to the panel:
 * Chrome opens the side panel natively; Firefox toggles the sidebar.
 * All data work happens in the panel page, so the worker stays stateless.
 */

interface FirefoxBrowser {
  sidebarAction?: { toggle(): Promise<void> };
}

const firefox = (globalThis as { browser?: FirefoxBrowser }).browser;

if (chrome.sidePanel?.setPanelBehavior) {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
} else if (firefox?.sidebarAction) {
  chrome.action.onClicked.addListener(() => {
    void firefox.sidebarAction!.toggle();
  });
}
