include("GCode.js");

function Tnc145(documentInterface, newDocumentInterface) {
    GCode.call(this, documentInterface, newDocumentInterface);
    this.lineNumber = 1;
    this.layerOptions = undefined;
    this.forceSign = true;
    this.useComma = true;
    this.trailingZeros = true;
    this.splitFullCircles = true;

    // make no assumptions about current position:
    this.x = undefined;
    this.xPrev = undefined;
    this.y = undefined;
    this.yPrev = undefined;
    this.z = undefined;
    this.zPrev = undefined;
}

Tnc145.prototype = new GCode();

Tnc145.prototype.initGlobalOptionWidget = function(w) {
    switch (w.objectName) {
    case "ZSafety":
        w.setEditText("unused");
        break;
    case "ZClear":
        w.addItems(["1", "2", "3"]);
        w.setEditText("1");
        break;
    case "ZCutting":
        w.addItems(["-0.5", "-0.4", "-0.3", "-0.2", "-0.1"]);
        w.setEditText("-0.3");
        break;
    case "Feedrate":
        w.addItems(["10", "20", "30", "40", "50"]);
        w.setEditText("30");
        break;
    }
};

Tnc145.prototype.getFileExtensions = function() {
    return ["cnc"];
};

Tnc145.prototype.writeHeader = function() {
    //this.writeLine("TOOL DEF 01 L+0 R+0,05");
    //this.writeLine("TOOL CALL 01 Z S 2000");
    //this.toolPosition = GCode.ToolPosition.Clear;
};

Tnc145.prototype.writeFooter = function() {
    this.writeLine("L %1 R0 F9999 M30".arg(this.getZCode(this.getToolUpLevel())));
};

Tnc145.prototype.gotModeChange = function(m) {
    return true;
};

Tnc145.prototype.getRapidMoveCode = function() {
    return "L";
};

Tnc145.prototype.getRapidMoveCodePostfix = function() {
    this.feedRateSet = true;
    return "R0 F9999 M13";
};

Tnc145.prototype.getLinearMoveCode = function() {
    return "L";
};

Tnc145.prototype.getLinearMoveCodePostfix = function() {
    return "R0 F%1 M".arg(Math.round(this.getFeedrate()));
};

Tnc145.prototype.getCircularCWMoveCode = function() {
    return "C";
};

Tnc145.prototype.getCircularCWMoveCodePostfix = function() {
    return "DR- R0 F%1 M".arg(Math.round(this.getFeedrate()));
};

Tnc145.prototype.getCircularCCWMoveCode = function() {
    return "C";
};

Tnc145.prototype.getCircularCCWMoveCodePostfix = function() {
    return "DR+ R0 F%1 M".arg(Math.round(this.getFeedrate()));
};

Tnc145.prototype.writeCircularMove = function(x, y, center, radius, startAngle, endAngle, isLarge, isReversed) {
    this.prepareForCutting();
    this.writeLine("CC " + this.getXCode(center.x) + " " + this.getYCode(center.y));
    GCode.prototype.writeCircularMove.call(this, x, y, center, radius, startAngle, endAngle, isLarge, isReversed);
};

Tnc145.prototype.getICode = function(value) {
    return "";
};

Tnc145.prototype.getJCode = function(value) {
    return "";
};

Tnc145.prototype.getLineNumberCode = function() {
    var ret = this.lineNumber.toString();
    this.lineNumber++;
    return ret;
};
