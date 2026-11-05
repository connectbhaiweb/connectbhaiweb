/* =====================================================================
   Care plan data adapter (GenieACS). MOCK for now.
   To go live, replace the body of `fetchDevices()` with a call to the GenieACS NBI
   (e.g. GET /devices?projection=...) and map each device with `toDevice()`; nothing else in the app changes.

   Device = {
     id, serialNumber, manufacturer, model,
     customer: { userId, name, mobile },
     status: "online" | "offline", lastInform: ISO string,
     wifi: { ssid, band: "2.4 GHz" | "5 GHz" | "Dual band", channel, connectedDevices, speedMbps },
     signal: { quality: "Good" | "Weak" | "Bad", rxPowerDbm },
     ip, uptimeSeconds, firmwareVersion,
     partner: { dsa: { userId, name }, tip: { userId, name } }
   }
   Visibility: customer = own device, dsa = its customers, tip = its customers, admin = all.
   ===================================================================== */
const MODELS = [["Huawei", "HG8145V5", "V5R020C10S115"], ["Nokia", "G-140W-C", "3FE49362IJHK46"], ["ZTE", "F670L", "V9.0.10P1N12"], ["TP-Link", "XC220-G3v", "1.2.3 Build 20230510"], ["Syrotech", "SY-GPON-1110-WDAONT", "4.0.21"]];
const NAMES = ["Ramesh Sharma", "Neha Jain", "Rakesh Khatri", "Pooja Soni", "Mohit Yadav", "Sandeep Verma", "Anita Nema", "Vikram Singh", "Kavita Patel", "Arjun Patel", "Deepak Yadav", "Neha Gupta", "Sana Sheikh", "Rohit Verma", "Priya Malviya", "Imran Khan", "Shweta Tiwari", "Manish Rathore", "Ankit Joshi", "Ritu Chouhan", "Harsh Agrawal", "Sneha Dubey", "Gaurav Mishra", "Tanvi Jain"];
const DSA = [{ userId: "u-dsa", name: "Sunil Verma" }, { userId: "u-dsa2", name: "Amit Sharma" }];
const TIP = [{ userId: "u-tip", name: "Malwa Fibernet" }, { userId: "u-tip2", name: "Sharma Networks" }];
const RX = [-18.4, -19.8, -21.2, -22.6, -24.1, -25.6, -26.4, -27.8];
const quality = rx => (rx >= -25 ? "Good" : rx >= -27 ? "Weak" : "Bad");

function toDevice(i, now) {
  const [manufacturer, model, firmwareVersion] = MODELS[i % MODELS.length];
  const name = NAMES[i % NAMES.length], online = i % 6 !== 4 && i % 9 !== 7, rx = RX[(i * 3) % RX.length];
  const mins = online ? 2 + (i * 7) % 13 : 60 * (3 + (i * 5) % 40);
  return {
    id: `dev-${String(i + 1).padStart(3, "0")}`,
    serialNumber: `${manufacturer.slice(0, 4).toUpperCase()}${(0xA1C300 + i * 4111).toString(16).toUpperCase()}`,
    manufacturer, model, firmwareVersion,
    customer: { userId: i === 0 ? "u-cust" : `u-c${i + 1}`, name, mobile: `98765${String(10001 + i * 37).slice(-5)}` },
    status: online ? "online" : "offline",
    lastInform: new Date(now - mins * 60e3).toISOString(),
    wifi: { ssid: `${name.split(" ")[0]}_CB_${["2G", "5G", "Home"][i % 3]}`, band: ["2.4 GHz", "5 GHz", "Dual band"][i % 3], channel: [1, 6, 11, 36, 44, 149][i % 6], connectedDevices: online ? 2 + (i * 5) % 9 : 0, speedMbps: online ? [48, 92, 98, 145, 186, 290][i % 6] : 0 },
    signal: { quality: online ? quality(rx) : "Bad", rxPowerDbm: online ? rx : null },
    ip: online ? `10.42.${10 + (i % 20)}.${20 + i * 3}` : null,
    uptimeSeconds: online ? 3600 * (5 + (i * 13) % 300) : 0,
    partner: { dsa: DSA[i % 3 === 2 ? 1 : 0], tip: TIP[i % 4 === 3 ? 1 : 0] },
  };
}
async function fetchDevices() {
  await new Promise(r => setTimeout(r, 250));                      // network-like delay
  const now = Date.now();
  return NAMES.map((_, i) => toDevice(i, now));
}
function visible(list, role, userId) {
  if (role === "admin") return list;
  if (role === "customer") return list.filter(d => d.customer.userId === userId);
  if (role === "dsa") return list.filter(d => d.partner.dsa.userId === userId);
  if (role === "tip") return list.filter(d => d.partner.tip.userId === userId);
  return [];
}
/** @returns {Promise<Device[]>} devices the given user may see */
export async function getCarePlanDevices({ role, userId }) { return visible(await fetchDevices(), role, userId); }
/** @returns {Promise<{ total: number, online: number, offline: number }>} */
export async function getCarePlanSummary({ role, userId }) {
  const d = await getCarePlanDevices({ role, userId });
  const online = d.filter(x => x.status === "online").length;
  return { total: d.length, online, offline: d.length - online };
}
