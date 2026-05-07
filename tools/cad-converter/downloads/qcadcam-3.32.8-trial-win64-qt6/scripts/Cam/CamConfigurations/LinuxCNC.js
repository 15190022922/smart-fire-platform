// include GCode configuration:
include("GCode.js");

// constructor: set up global settings:
function LinuxCnc(documentInterface, newDocumentInterface) {
    GCode.call(this, documentInterface, newDocumentInterface);

    // output unit is same as input unit

    // output four decimals (e.g. 1.2345):
    this.decimals = 4;
}

// configuration is derived from GCode:
LinuxCnc.prototype = new GCode();
LinuxCnc.displayName = "LinuxCnc";

LinuxCnc.prototype.getFileExtensions = function() {
    // set allowed output file extension:
    return ["ngc"];
};

LinuxCnc.prototype.initGlobalOptionWidget = function(w) {
    switch (w.objectName) {
    case "ZSafety":
        w.addItems(["2", "1", "0.5"]);
        w.setEditText("0.5");
        break;
    case "ZClear":
        w.addItems(["0.25", "0.5", "1"]);
        w.setEditText("0.25");
        break;
    case "ZCutting":
        w.addItems(["-0.125", "-0.25", "-0.5"]);
        w.setEditText("-0.125");
        break;
    }
};

// change default to inch
LinuxCnc.prototype.initLayerOptionWidget = function(w) {
    switch (w.objectName) {
    case "ZCutting":
        w.addItems(["default", "-0.125", "-0.250", "-0.375"]);
        w.currentText = "default";
        break;
    }
};

LinuxCnc.prototype.getRapidMoveCode = function() {
    return "G0";
};

LinuxCnc.prototype.getLinearMoveCode = function() {
    return "G1";
};

LinuxCnc.prototype.getCircularCWMoveCode = function() {
    return "G2";
};

LinuxCnc.prototype.getCircularCCWMoveCode = function() {
    return "G3";
};

LinuxCnc.prototype.getLineNumberCode = function() {
    // don't use line numbers:
    return "";
};

// header:
LinuxCnc.prototype.writeHeader = function() {
    var g20 = "G20";
    if (this.unit===RS.Millimeter) {
        g20 = "G21"
    }

    var g90 = "G90";
    if (this.getIncrementalXYZ()) {
        g90 = "G91"
    }

    // LinuxCnc header:
    this.writeLine(g20 + " G17 G40 G49 G54 G64 P0.005 G80 " + g90 + " G94");

    // retreat to safety level:
    this.writeRapidZMove(this.getSafetyZLevel());
    this.toolPosition = GCode.ToolPosition.Clear;
};

// footer:
LinuxCnc.prototype.writeFooter = function() {
    this.writeToolUp();
    this.writeRapidZMove(this.getSafetyZLevel());
    this.toolPosition = GCode.ToolPosition.Clear;
    this.writeLine("M2");
};
