include("scripts/Cam/CamExport/CamExporter.js");

function HPGL(documentInterface, newDocumentInterface) {
    CamExporter.call(this, documentInterface, newDocumentInterface);

    this.toolPosition = HPGL.ToolPosition.Up;
    this.separator = ";";
    this.decimals = 4;
    this.unit = RS.Millimeter;

    // HP/GL unit is 1/40mm:
    this.scale = 40;

    /*
    this.g = undefined;
    this.gPrev = undefined;
    this.i = undefined;
    this.j = undefined;
    this.f = undefined;
    this.fPrev = undefined;

    // these need to be initialized for incremental positioning:
    this.x = 0.0;
    this.xPrev = 0.0;
    this.y = 0.0;
    this.yPrev = 0.0;
    this.z = 0.0;
    this.zPrev = 0.0;


    this.globalOptions = "GCode";
    this.layerOptions = "GCodeLayer";
    */
}

HPGL.prototype = new CamExporter();

HPGL.Mode = {
    Normal : 1,
    CircularCW: 2,
    CircularCCW: 3
};

HPGL.ToolPosition = {
    Up : 1,
    Down : 2
};

/*
HPGL.prototype.initGlobalOptionWidget = function(w) {
    switch (w.objectName) {
    case "ZSafety":
        w.addItems(["200", "150", "100", "50"]);
        w.setEditText("100");
        break;
    case "ZClear":
        w.addItems(["1", "2", "3"]);
        w.setEditText("2");
        break;
    case "ZCutting":
        w.addItems(["-1", "-2", "-3"]);
        w.setEditText("-2");
        break;
    }
};

HPGL.prototype.initLayerOptionWidget = function(w) {
    switch (w.objectName) {
    case "ZCutting":
        w.addItems(["default", "-1", "-2", "-3"]);
        w.currentText = "default";
        break;
    }
};
*/

HPGL.prototype.getFileExtensions = function() {
    return ["plt"];
};

HPGL.prototype.toolIsUp = function() {
    this.toolPosition = HPGL.ToolPosition.Up;
};

HPGL.prototype.toolIsDown = function() {
    this.toolPosition = HPGL.ToolPosition.Down;
};

HPGL.prototype.writeToolUp = function() {
    this.write("PU" + this.separator);
    this.toolIsUp();
};

HPGL.prototype.writeToolDown = function() {
    this.write("PD" + this.separator);
    this.toolIsDown();
};

HPGL.prototype.prepareForDrawing = function() {
    // force tool down before normal move:
    if (this.toolPosition !== HPGL.ToolPosition.Down) {
        // force tool up before tool down:
        if (this.toolPosition !== HPGL.ToolPosition.Up) {
            this.writeToolUp();
        }
        this.writeToolDown();
    }
};

// move:
HPGL.prototype.writeRapidLinearMove = function(x, y) {
    if (!this.gotXMove(x) && !this.gotYMove(y)) {
        return;
    }

    this.writeToolUp();
    this.g = HPGL.Mode.Normal;
    this.x = x;
    this.y = y;
    this.writeMove();
};

// line:
HPGL.prototype.writeLinearMove = function(x, y) {
    this.prepareForDrawing();

    this.g = HPGL.Mode.Normal;
    this.x = x;
    this.y = y;
    this.writeMove();
};

// arc:
HPGL.prototype.writeCircularMove = function(x, y,
                                            center, radius,
                                            startAngle, endAngle,
                                            isLarge, isReversed) {

    this.prepareForDrawing();

    if (isReversed) {
        this.g = HPGL.Mode.CircularCW;
    }
    else {
        this.g = HPGL.Mode.CircularCCW;
    }

    this.i = center.x;
    this.j = center.y;
    this.x = x;
    this.y = y;
    this.sweep = new RArc(center, radius, startAngle, endAngle, isReversed).getSweep();
    this.writeMove();
};

HPGL.prototype.writeHeader = function() {
    this.toolPosition = HPGL.ToolPosition.Up;
    this.write("\u001B.(;\u001B.I81;;17:\u001B.N;19:IN;SC;PU;VS;VS36;SP1;");
};

HPGL.prototype.writeFooter = function() {
    this.writeToolUp();
    this.write("PA0,0;SP;EC;PG1;EC1;OE;");
    this.toolPosition = HPGL.ToolPosition.Up;
};

HPGL.prototype.gotXMove = function(x) {
    return (isNull(this.xPrev) && !isNull(x)) || (!isNull(x) && !this.fuzzyCompare(x, this.xPrev));
};

HPGL.prototype.gotYMove = function(y) {
    return (isNull(this.yPrev) && !isNull(y)) || (!isNull(y) && !this.fuzzyCompare(y, this.yPrev));
};

HPGL.prototype.gotModeChange = function(m) {
    return (isNull(this.gPrev) && !isNull(m)) || (!isNull(m) && this.gPrev!=m);
};

HPGL.prototype.append = function(line, str) {
    if (line.length===0) {
        return str;
    }
    else {
        return line + this.separator + str;
    }
};

HPGL.prototype.formatNumber = function(value) {
    return sprintf("%.%1f".arg(this.decimals), value);
};

/**
 * Writes the next line of the file or the given custom line with line nummer.
 *
 * \param custom string (optional) custom line contents
 * \param append string (optional) append custom to generated line contents
 */
HPGL.prototype.writeMove = function(custom, append) {
    var line = "";

    if (!isNull(custom)) {
        line = this.append(line, custom);
        this.write(line);
        return;
    }

    var gotModeChange = this.gotModeChange(this.g);

    switch (this.g) {
    case HPGL.Mode.Normal:
        line = "PA" + this.formatNumber(this.x) + "," + this.formatNumber(this.y) + this.separator;
        break;
    case HPGL.Mode.CircularCW:
    case HPGL.Mode.CircularCCW:
        line = "AA" + this.formatNumber(this.i) + "," + this.formatNumber(this.j) + "," 
            + this.formatNumber(RMath.rad2deg(this.sweep)) + this.separator;
        break;
    }

    if (!isNull(append)) {
        line = this.append(line, append);
    }

    //CamExporter.prototype.writeMove.call(this, line);
    this.write(line);

    this.xPrev = this.x;
    this.yPrev = this.y;
    this.gPrev = this.g;
};
