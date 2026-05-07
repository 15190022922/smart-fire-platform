include("GCode.js");

function GCodeAbsIJ(documentInterface, newDocumentInterface) {
    GCode.call(this, documentInterface, newDocumentInterface);

    this.absoluteIJ = true;
}

GCodeAbsIJ.prototype = new GCode();

