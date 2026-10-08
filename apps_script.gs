/*
TỦ THUỐC GIA ĐÌNH - Google Apps Script
1) Tạo một Google Sheet mới.
2) Extensions > Apps Script.
3) Dán toàn bộ code này vào Code.gs.
4) Thay SHEET_ID bằng ID trong URL Google Sheet.
5) Deploy > New deployment > Web app.
   Execute as: Me
   Who has access: Anyone with the link
6) Copy URL /exec và dán vào API_URL trong index.html.

Sheet sẽ tự tạo 2 trang:
THUOC và THUOC_THU_VIEN
*/
const SHEET_ID = "1Ua_U1vrazAWs02pnfVX2ilP2v6-RrohJh6kPwA4LLLo";

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

// Run once from the Apps Script editor as the owner. Copy the logged secret
// into Google Authenticator using manual setup. Never put this secret in index.html.
function setupAuthenticator() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("TOTP_SECRET")) throw new Error("Authenticator is already configured. Use resetAuthenticator only if replacing the host device.");
  const raw = (Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "")).slice(0, 40);
  const secret = hexToBase32_(raw);
  props.setProperty("TOTP_SECRET", secret);
  Logger.log("Add a time-based 6-digit code in Google Authenticator with this setup key: " + secret);
  Logger.log("Issuer: Tu Thuoc Gia Dinh; period: 30 seconds.");
}

function resetAuthenticator() {
  const props = PropertiesService.getScriptProperties();
  const raw = (Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "")).slice(0, 40);
  const secret = hexToBase32_(raw);
  props.setProperty("TOTP_SECRET", secret);
  props.deleteProperty("TOTP_LAST_STEP");
  props.deleteProperty("AUTH_FAIL_STEP");
  props.deleteProperty("AUTH_FAIL_COUNT");
  Logger.log("Authenticator seed replaced. Add this new setup key in Google Authenticator: " + secret);
  Logger.log("All existing device tokens remain valid.");
}

function revokeAllDevices() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).filter(k => k.indexOf("DEVICE_") === 0).forEach(k => props.deleteProperty(k));
}

function hexToBase32_(hex) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = hex.match(/.{2}/g).map(x => parseInt(x, 16));
  let output = "", buffer = 0, bits = 0;
  bytes.forEach(byte => {
    buffer = (buffer << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; output += alphabet[(buffer >> bits) & 31]; buffer &= (1 << bits) - 1; }
  });
  if (bits) output += alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

function base32ToBytes_(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = []; let buffer = 0, bits = 0;
  String(secret).replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, "").split("").forEach(ch => {
    buffer = (buffer << 5) | alphabet.indexOf(ch); bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 255); buffer &= (1 << bits) - 1; }
  });
  return bytes;
}

function totpForStep_(secret, step) {
  let counter = step; const message = new Array(8).fill(0);
  for (let i = 7; i >= 0; i--) { message[i] = counter & 255; counter = Math.floor(counter / 256); }
  const hmac = Utilities.computeHmacSha1Signature(message, base32ToBytes_(secret));
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | ((hmac[offset + 1] & 255) << 16) | ((hmac[offset + 2] & 255) << 8) | (hmac[offset + 3] & 255);
  return String(binary % 1000000).padStart(6, "0");
}

function hashToken_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

function activateDevice_(code) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty("TOTP_SECRET");
    if (!secret) return json_({ok:false,error:"Authenticator has not been configured by the owner."});
    const now = Math.floor(Date.now() / 30000);
    const failStep = Number(props.getProperty("AUTH_FAIL_STEP") || -1);
    let failures = failStep === now ? Number(props.getProperty("AUTH_FAIL_COUNT") || 0) : 0;
    const retryAfter = 30 - Math.floor((Date.now() % 30000) / 1000);
    if (failures >= 3) return json_({ok:false,error:"Three incorrect attempts. Wait for the next Authenticator code.",retryAfter});
    const candidate = String(code || "").trim();
    const lastAccepted = Number(props.getProperty("TOTP_LAST_STEP") || -1);
    let acceptedStep = null;
    if (/^\d{6}$/.test(candidate)) {
      for (let offset = -1; offset <= 1; offset++) {
        const step = now + offset;
        if (step > lastAccepted && totpForStep_(secret, step) === candidate) acceptedStep = step;
      }
    }
    if (acceptedStep === null) {
      failures++;
      props.setProperty("AUTH_FAIL_STEP", String(now));
      props.setProperty("AUTH_FAIL_COUNT", String(failures));
      return json_({ok:false,error:failures >= 3 ? "Three incorrect attempts. Wait for the next Authenticator code." : "Incorrect or already used code.",attemptsRemaining:Math.max(0,3-failures),retryAfter:failures >= 3 ? retryAfter : 0});
    }
    props.setProperty("TOTP_LAST_STEP", String(acceptedStep));
    props.deleteProperty("AUTH_FAIL_STEP"); props.deleteProperty("AUTH_FAIL_COUNT");
    const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    props.setProperty("DEVICE_" + hashToken_(token), "1");
    return json_({ok:true,deviceToken:token});
  } finally { lock.releaseLock(); }
}

function deviceAuthorized_(token) {
  if (!token || String(token).length < 40) return false;
  return PropertiesService.getScriptProperties().getProperty("DEVICE_" + hashToken_(token)) === "1";
}

function doGet(e) {
  if (!deviceAuthorized_(e && e.parameter && e.parameter.deviceToken)) return json_({ok:false,error:"Device activation required."});
  const sh = getSheet_("THUOC", ["ID","Tên thuốc","Số lượng","Đơn vị","Hạn sử dụng","Mức tối thiểu","Công dụng","Cách dùng","Ghi chú","Ảnh","ID thư viện"]);
  sh.getRange(1,10,1,2).setValues([["Ảnh","ID thư viện"]]);
  const values = sh.getDataRange().getValues();
  const drugs = values.slice(1).filter(r => r[0] !== "").map(r => ({
    id:String(r[0]), name:String(r[1]), qty:Number(r[2]||0), unit:String(r[3]||""),
    expiry:r[4] ? Utilities.formatDate(new Date(r[4]), Session.getScriptTimeZone(), "yyyy-MM-dd") : "",
    minQty:Number(r[5]||0), use:String(r[6]||""), dose:String(r[7]||""), note:String(r[8]||""), image:String(r[9]||""), libraryId:String(r[10]||"")
  }));
  const library = readLibrary_();
  const deletedLibraryIds = JSON.parse(PropertiesService.getScriptProperties().getProperty("LIBRARY_DELETED_IDS") || "[]");
  return json_({ok:true,drugs,library,deletedLibraryIds});
}

function readLibrary_() {
  const sh = getSheet_("THUOC_THU_VIEN", ["ID","Tên thuốc","Ảnh","Công dụng","Cách dùng","Ngày lưu"]);
  return sh.getDataRange().getValues().slice(1).filter(r => r[0] !== "").map(r => ({
    id:String(r[0]), name:String(r[1]), image:String(r[2]||""), use:String(r[3]||""), dose:String(r[4]||"")
  }));
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents || "{}"); }
  catch (err) { return json_({ok:false,error:"Invalid JSON"}); }
  if (body.action === "activateDevice") return activateDevice_(body.code);
  if (!deviceAuthorized_(body.deviceToken)) return json_({ok:false,error:"Device activation required."});
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.action === "replaceAll" && Array.isArray(body.drugs)) {
      const sh = getSheet_("THUOC", ["ID","Tên thuốc","Số lượng","Đơn vị","Hạn sử dụng","Mức tối thiểu","Công dụng","Cách dùng","Ghi chú","Ảnh","ID thư viện"]);
      sh.getRange(1,10,1,2).setValues([["Ảnh","ID thư viện"]]);
      if (sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,11).clearContent();
      const rows = body.drugs.map(x => [x.id,x.name,Number(x.qty||0),x.unit||"",x.expiry?new Date(x.expiry):"",Number(x.minQty||0),x.use||"",x.dose||"",x.note||"",x.image||"",x.libraryId||""]);
      if(rows.length) sh.getRange(2,1,rows.length,11).setValues(rows);
      return json_({ok:true,count:rows.length});
    }
    if (body.action === "upsertLibrary" && body.entry && body.entry.id) {
      const sh = getSheet_("THUOC_THU_VIEN", ["ID","Tên thuốc","Ảnh","Công dụng","Cách dùng","Ngày lưu"]);
      const ids = sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String) : [];
      const found = ids.indexOf(String(body.entry.id));
      const row = [String(body.entry.id),String(body.entry.name||""),String(body.entry.image||""),String(body.entry.use||""),String(body.entry.dose||""),new Date()];
      const rowNumber = found<0 ? sh.getLastRow()+1 : found+2;
      sh.getRange(rowNumber,1,1,6).setValues([row]);
      const properties = PropertiesService.getScriptProperties();
      const deleted = JSON.parse(properties.getProperty("LIBRARY_DELETED_IDS") || "[]").filter(id => String(id) !== String(body.entry.id));
      properties.setProperty("LIBRARY_DELETED_IDS", JSON.stringify(deleted));
      return json_({ok:true,id:String(body.entry.id)});
    }
    if (body.action === "deleteLibrary" && body.id) {
      const sh = getSheet_("THUOC_THU_VIEN", ["ID","Tên thuốc","Ảnh","Công dụng","Cách dùng","Ngày lưu"]);
      const ids = sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String) : [];
      const found = ids.indexOf(String(body.id));
      if (found>=0) sh.deleteRow(found+2);
      const properties = PropertiesService.getScriptProperties();
      const deleted = JSON.parse(properties.getProperty("LIBRARY_DELETED_IDS") || "[]").map(String);
      if (!deleted.includes(String(body.id))) deleted.push(String(body.id));
      properties.setProperty("LIBRARY_DELETED_IDS", JSON.stringify(deleted));
      return json_({ok:true,deleted:found>=0});
    }
    return json_({ok:false,error:"Unsupported action"});
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
