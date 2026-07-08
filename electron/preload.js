// electron/preload.js — Secure context bridge for renderer process
const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Trigger printing of an invoice or report.
   * @param {'thermal'|'a4'|'report'} type - Print format
   * @param {object} data - Invoice/report data to print
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  print: (type, data) => ipcRenderer.invoke('print', type, data),

  /**
   * Get list of available system printers.
   * @returns {Promise<Electron.PrinterInfo[]>}
   */
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  /**
   * Open a URL in the user's default browser.
   * @param {string} url - The URL to open
   * @returns {Promise<void>}
   */
  openExternal: (url) => shell.openExternal(url),

  /**
   * Get the application version from package.json.
   * @returns {Promise<string>}
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  /**
   * The current OS platform (win32, darwin, linux).
   * @type {string}
   */
  platform: process.platform,
});
