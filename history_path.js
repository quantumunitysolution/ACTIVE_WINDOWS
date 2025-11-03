const Path = require('path');

const homeDirectory = process.env.HOME;

function setupForWindows() {
    let defaultPaths = {}

    const appDataDirectory = Path.join(process.env.HOMEDRIVE, "Users", process.env.USERNAME, "AppData");

    defaultPaths.chrome = Path.join(appDataDirectory, "Local", "Google", "Chrome", "User Data");
    defaultPaths.avast = Path.join(appDataDirectory, "Local", "Google", "AVAST Software", "User Data");
    defaultPaths.firefox = Path.join(appDataDirectory, "Roaming", "Mozilla", "Firefox", "User Data");
    defaultPaths.opera = Path.join(appDataDirectory, "Roaming", "Opera Software", "Opera Stable");
    defaultPaths.edge = Path.join(appDataDirectory, "Local", "Microsoft", "Edge", "User Data");
    defaultPaths.torch = Path.join(appDataDirectory, "Local", "Torch", "User Data");
    defaultPaths.seamonkey = Path.join(appDataDirectory, "Roaming", "Mozilla", "SeaMonkey", "User Data");
    defaultPaths.brave = Path.join(appDataDirectory, "Local", "BraveSoftware", "Brave-Browser", "User Data");
    defaultPaths.vivaldi = Path.join(appDataDirectory, "Local", "Vivaldi", "User Data");
    return defaultPaths
}

function setupForMac() {
    let defaultPaths = {}
    defaultPaths.chrome = Path.join(homeDirectory, "Library", "Application Support", "Google", "Chrome");
    defaultPaths.avast = Path.join(homeDirectory, "Library", "Application Support", "AVAST Software", "Browser");
    defaultPaths.firefox = Path.join(homeDirectory, "Library", "Application Support", "Firefox");
    defaultPaths.edge = Path.join(homeDirectory, "Library", "Application Support", "Microsoft Edge");
    defaultPaths.opera = Path.join(homeDirectory, "Library", "Application Support", "com.operasoftware.Opera");
    defaultPaths.maxthon = Path.join(homeDirectory, "Library", "Application Support", "com.maxthon.mac.Maxthon");
    defaultPaths.vivaldi = Path.join(homeDirectory, "Library", "Application Support", "Vivaldi");
    defaultPaths.seamonkey = Path.join(homeDirectory, "Library", "Application Support", "SeaMonkey", "Profiles");
    defaultPaths.brave = Path.join(homeDirectory, "Library", "Application Support", "BraveSoftware", "Brave-Browser");
    return defaultPaths;
}

function setupForLinux() {
    let defaultPaths = {}
    defaultPaths.firefox = Path.join(homeDirectory, ".mozilla", "firefox");
    defaultPaths.chrome = Path.join(homeDirectory, ".config", "google-chrome");
    return defaultPaths
}

function setupDefaultPaths(defaultPaths) {
    switch (process.platform) {
        case 'darwin':
            return setupForMac(defaultPaths);
        case 'linux':
            return setupForLinux(defaultPaths);
        case 'win32':
            return setupForWindows(defaultPaths);
        default:
            console.error(`Platform ${process.platform} is not supported by node-browser-history`);
    }
}

module.exports = {
    setupDefaultPaths
};