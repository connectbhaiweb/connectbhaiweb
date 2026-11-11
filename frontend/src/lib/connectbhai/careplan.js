/* Care plan data adapter. There is no sample modem list any more: real modems come from the API
   (API.carePlanDevices, see rest.js). Where the API has no modem list (the in-browser demo), the list is simply empty. */
export async function getCarePlanDevices() { return []; }
export async function getCarePlanSummary() { return { total: 0, online: 0, offline: 0 }; }
