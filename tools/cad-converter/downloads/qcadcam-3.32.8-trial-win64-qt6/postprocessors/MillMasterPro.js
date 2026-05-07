// Include definition of class GCodeMM:
include("GCodeMM.js");

// Constructor:
function MillMasterPro(cadDocumentInterface, camDocumentInterface) {
    GCodeMM.call(this, cadDocumentInterface, camDocumentInterface);

    this.decimals = 3;

    this.outputOffsetPath = true;

    this.fileExtensions = [ "cnc" ];

    // no z moves:
    this.rapidMoveZ = [];
    this.linearMoveZ = [];
    this.firstLinearMoveZ = [];
    this.firstPointMoveZ = [];

    this.rapidMove = [];

    this.header = [
        "G90   /-- Absolute Programming Mode",
        "G75   /-- Multiple Quadrant Arc Mode",
        "/G92 X0. Y0.2   /-- Set current position.",
        "M9"
    ];

    this.toolHeader = [
        "M06 [T]   /-- Tool Change"
    ];

    this.toolpathHeader = [
        "G00 [X1] [Y1]"
    ];

    this.toolpathFooter = [
    ];

    this.toolFooter = [
    ];

    this.footer = [
        "M25",
        "M2"
    ];

    this.contourHeader = [
        "M8"
    ];
    this.contourFooter = [
        "M9"
    ];

    this.firstLinearMove =           "G01 [X] [Y] [F]";
    this.linearMove =                "G01 [X] [Y] [F]";

    this.firstArcCWMove =            "G02 [X] [Y] [I] [J] [F]";
    this.arcCWMove =                 "G02 [X] [Y] [I] [J] [F]";

    this.firstArcCCWMove =           "G03 [X] [Y] [I] [J] [F]";
    this.arcCCWMove =                "G03 [X] [Y] [I] [J] [F]";
}

// Configuration is derived from GCodeMM:
MillMasterPro.prototype = new GCodeMM();

// Display name shown in user interface:
MillMasterPro.displayName = "MillMasterPro (Offset) [mm]";
MillMasterPro.description = "MillMaster Pro";

