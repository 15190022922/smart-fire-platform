include("GCodeIN.js");

function PecanIN(cadDocumentInterface, camDocumentInterface) {
    GCodeIN.call(this, cadDocumentInterface, camDocumentInterface);

    this.fileExtensions = [ "tap" ];

    // disable line numbers:
    this.empty = "";
    this.registerVariable("empty", "N", true, "", 0);


    // always output 4 decimals, output trailing zeroes for X/Y/Z:
    this.registerVariable("xPosition", "X", true, "X", 4, { trailingZeroes: true });
    this.registerVariable("yPosition", "Y", true, "Y", 4, { trailingZeroes: true });
    this.registerVariable("zPosition", "Z", true, "Z", 4, { trailingZeroes: true });

    this.registerVariable("zHomePosition", "ZH", true,  "Z", 4, { trailingZeroes: true });

    this.registerVariable("feedRate", "F", true, "F", 0);
    this.registerVariable("plungeRate", "FP", true, "F", 0);

    // register variable (this.thickness will be output for the [THICKNESS] placeholder:
    //this.registerVariable("thickness", "THICKNESS", true, "", 0);

    // define header to contain placeholder for thickness:
    this.header = [ 
        "( Pecan )",
        "G90",        // absolute positioning
        "G20",        // inch
        "[F]",        // feedrate
        "G64 P.01",   // probably "Cancel Exact Stop" (?)
        "S [S#]",     // rpm
        "M3",         // spindle on (?)
        "G0 [ZH]",    // rapid move to safety level e.g. Z0.8
    ];    

    this.footer = [
        "G00 [ZH]",
        "G00 X0.0000 Y0.0000",
        "M02",
    ]

    // tool change (N/A):
    this.toolHeader = [ ];

    // rapid moves:
    this.rapidMove = [
        "[F]",
        "G00 [X] [Y] [Z]",
    ];
    this.rapidMoveZ = [
        "[F]",
        "G00 [X] [Y] [Z]",
    ];
    this.rapidMoveZUp = [
        "[F]",
        "G00 [X] [Y] [Z]",
    ];

    // linear moves:
    this.firstLinearMove = [
        "[F]", 
        "G01 [X] [Y] [Z]",
    ];
    this.linearMove = "G01 [X] [Y] [Z]";

    // linear Z moves:
    this.firstLinearMoveZ = [
        "[F]",
        "G01 [X] [Y] [Z]",
    ];
    this.linearMoveZ = "G01 [X] [Y] [Z]";

    // point moves for drilling:
    this.firstPointMoveZ = this.firstLinearMoveZ;
    this.pointMoveZ = this.linearMoveZ;

    // circular moves (controller has likely no arc support):
    this.firstArcCWMove = [];        //"G02 [X] [Y] [I] [J]";
    this.arcCWMove = [];             //"G02 [X] [Y] [I] [J]";

    this.firstArcCCWMove = [];       //"G03 [X] [Y] [I] [J]";
    this.arcCCWMove = [];            //"G03 [X] [Y] [I] [J]";

    // tool compensation on (N/A):
    this.linearMoveCompensationLeft = [];
    this.linearMoveCompensationRight = [];

    // tool compensation off:
    this.linearMoveCompensationOff = [];
}

PecanIN.prototype = new GCodeIN();

PecanIN.displayName = "Pecan (Offset) [in]";

PecanIN.prototype.writeFile = function(fileName) {
    // set variable to value from CAM config dialog
    // "MyThickness" corresponds to the objectName of the GUI element:
    //this.thickness = this.getGlobalOption("MyThickness", "0.0");

    return GCodeIN.prototype.writeFile.call(this, fileName);
};

PecanIN.prototype.writeRapidMoveZ = function() {
    // ignore first Z move:
    if (isNull(this.xPosition) || isNull(this.yPosition)) {
        return;
    }

    this.currentEntity.dump();

    // ignore last tool up:
    var rapidMoveToSafety = this.getEntityOptionBool(this.currentEntity, "CamRapidMoveToSafety", false);
    if (rapidMoveToSafety) {
        return;
    }

    this.writeBlock("rapidMoveZ");
};

PecanIN.prototype.writeLinearMove = function() {
    var first = this.getEntityOptionBool(this.currentEntity, "CamFirstSegment", false);
    if (first) {
        this.writeBlock("firstLinearMove");
    }
    else {
        this.writeBlock("linearMove");
    }

    this.lastMoveGCode = 1;
};

PecanIN.prototype.writeLinearMoveZ = function() {
    var toolUp = this.getEntityOptionBool(this.currentEntity, "CamToolUp", false);
    if (toolUp) {
        this.writeBlock("rapidMoveZUp");
    }
    else {
        this.writeBlock("linearMoveZ");
    }
};

PecanIN.prototype.initConfigDialog = function(dialog) {
    /*
    var group = dialog.findChild("GroupCustom");
    var vBoxLayout = group.layout();

    // add row:
    var hBoxLayout = new QHBoxLayout(null);
    vBoxLayout.addLayout(hBoxLayout, 0);

    // add label:
    var lThickness = new QLabel(qsTr("Thickness:"));
    hBoxLayout.addWidget(lThickness, 0,0);

    // add text input field:
    var leThickness = new RMathLineEdit();
    leThickness.objectName = "MyThickness";
    hBoxLayout.addWidget(leThickness, 0,0);

    // add next row...
    */
};

PecanIN.prototype.exportArc = function(shape) {
    // interpolate arcs with line segments:
    var pl = shape.approximateWithLines(this.getArcSegmentLength());
    var plSegments = pl.getExploded();
    for (var k=0; k<plSegments.length; k++) {
        var plSegment = plSegments[k];
        this.exportLine(plSegment);
        this.ignoredContexts = [ "CamFirstSegment" ];
    }
};

PecanIN.prototype.getArcInterpolation = function() {
    return false;
};
