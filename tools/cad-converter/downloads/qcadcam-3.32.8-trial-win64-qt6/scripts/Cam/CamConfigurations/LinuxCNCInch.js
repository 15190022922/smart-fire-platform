// include LinuxCnc configuration:
include("LinuxCnc.js");

// constructor: set up global settings:
function LinuxCncInch(documentInterface, newDocumentInterface) {
    LinuxCnc.call(this, documentInterface, newDocumentInterface);

    // output unit is always inch:
    this.unit = RS.Inch;

    // output four decimals (e.g. 1.2345):
    this.decimals = 4;
}

// configuration is derived from LinuxCnc:
LinuxCncInch.prototype = new LinuxCnc();
LinuxCncInch.displayName = "LinuxCnc (Inch)";
