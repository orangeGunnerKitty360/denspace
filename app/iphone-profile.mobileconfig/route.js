import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const appUrl = "https://denspace.vercel.app/";
const profileUuid = "E6C48755-D74C-4CB8-9D16-8A931DDE4F5E";
const webClipUuid = "A15D7AD7-323D-44CF-A690-B73598713AE1";

function escapePlist(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function plistData(data) {
  return data.toString("base64").replace(/(.{68})/g, "$1\n");
}

export async function GET() {
  const iconPath = path.join(process.cwd(), "public", "assets", "denspace-icon-180.png");
  const icon = await readFile(iconPath);
  const iconData = plistData(icon);

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>Icon</key>
      <data>
${iconData}
      </data>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>DenSpace</string>
      <key>PayloadDescription</key>
      <string>Adds DenSpace to your iPhone home screen.</string>
      <key>PayloadDisplayName</key>
      <string>DenSpace</string>
      <key>PayloadIdentifier</key>
      <string>com.denspace.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>${webClipUuid}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <false/>
      <key>URL</key>
      <string>${escapePlist(appUrl)}</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Downloads a DenSpace home-screen profile for iPhone.</string>
  <key>PayloadDisplayName</key>
  <string>DenSpace iPhone Profile</string>
  <key>PayloadIdentifier</key>
  <string>com.denspace.iphone-profile</string>
  <key>PayloadOrganization</key>
  <string>DenSpace</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${profileUuid}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

  return new Response(plist, {
    headers: {
      "Content-Type": "application/x-apple-aspen-config",
      "Content-Disposition": 'attachment; filename="DenSpace.mobileconfig"',
      "Cache-Control": "public, max-age=3600"
    }
  });
}
