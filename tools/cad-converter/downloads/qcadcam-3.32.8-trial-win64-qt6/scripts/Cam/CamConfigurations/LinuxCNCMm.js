// include LinuxCnc configuration:
include("LinuxCnc.js");

// constructor: set up global settings:
function LinuxCncMm(documentInterface, newDocumentInterface) {
    LinuxCnc.call(this, documentInterface, newDocumentInterface);

    // output unit is always Millimeter:
    this.unit = RS.Millimeter;

    // output three decimals (e.g. 1.234):
    this.decimals = 3;
}

// configuration is derived from LinuxCnc:
LinuxCncMm.prototype = new LinuxCnc();
LinuxCncMm.displayName = "LinuxCnc (Millimeter)";
