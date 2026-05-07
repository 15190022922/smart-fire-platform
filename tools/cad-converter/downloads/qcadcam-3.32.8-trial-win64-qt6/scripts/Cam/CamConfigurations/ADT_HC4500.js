include("GCode.js");

function ADT_HC4500(documentInterface, newDocumentInterface) {
    GCode.call(this, documentInterface, newDocumentInterface);
    this.separator = "";

    // split circles into two halves:
    this.splitFullCircles = true;

    // ramp on from center, 50% away from contour edge:
    this.rampOn = true;
    this.rampOnFactor = 0.5;

    // ramp off towards center, 20% away from contour edge:
    this.rampOff = true;
    this.rampOffFactor = 0.2;

    // cut all contours counter-clockwise:
    this.orientation = Contour.Orientation.CW;

    // use relative coordinates for X/Y?
    this.incrementalXYZ = false;

    // Increased tolerance since GBX files tend to be less precise:
    this.tolerance = 0.005;

    this.globalOptions = undefined;
    this.layerOptions = undefined;
}

ADT_HC4500.prototype = new GCode();

ADT_HC4500.prototype.getFileExtensions = function() {
    return ["cnc"];
};

ADT_HC4500.prototype.getLineNumberCode = function() {
    return "";
};

ADT_HC4500.prototype.writeHeader = function() {
    this.writeLine("G92 X0. Y0.");
    this.xPrev = 0.0;
    this.yPrev = 0.0;
    this.writeLine("G21");

    if (this.getIncrementalXYZ()) {
        // incremental:
        this.writeLine("G91");
    }
    else {
        // absolute:
        this.writeLine("G90");
    }
};

ADT_HC4500.prototype.writeFooter = function() {
    GCode.prototype.writeFooter.call(this);
    this.writeLine("G00 X0. Y0.");
    this.writeLine("M02");
};

ADT_HC4500.prototype.writeToolUp = function() {
    this.writeLine("M08");
    this.writeLine("G40");
    this.toolIsUp();
};

ADT_HC4500.prototype.writeToolDown = function() {
    this.writeLine("G41");
    this.writeLine("M07");
    this.toolIsDown();
};
