import base from "/home/user/chessroyale/playwright.config.ts";
export default { ...base, use: { ...(base as any).use, launchOptions: { executablePath: "/opt/pw-browsers/chromium" } }, projects: (base as any).projects.map((p: any) => ({ ...p, use: { ...p.use, launchOptions: { executablePath: "/opt/pw-browsers/chromium" } } })) };
