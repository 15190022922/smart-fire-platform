include("GCode.js");

function GCodeInch(documentInterface, newDocumentInterface) {
    GCode.call(this, documentInterface, newDocumentInterface);
    this.unit = RS.Inch;
    this.decimals = 4;
}

GCodeInch.prototype = new GCode();

