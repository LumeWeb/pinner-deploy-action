// Stub module: replaces packages that cause runtime crashes when bundled
// (native addons, createRequire side effects). These packages are only
// needed for WebRTC/UPnP which the GitHub Action never uses.
const noop = () => () => {}
export const webRTC = noop
export const webRTCDirect = noop
export const upnpNat = noop
export const uPnPNAT = noop
export default noop
