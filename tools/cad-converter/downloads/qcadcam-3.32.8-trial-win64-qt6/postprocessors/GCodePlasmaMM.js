include("GCodeBase.js");

function GCodePlasmaMM(cadDocumentInterface, camDocumentInterface) {
    GCodeBase.call(this, cadDocumentInterface, camDocumentInterface);

    // decimals:
    this.decimals = 4;
    // output in Millimeters:
    this.unit = RS.Millimeter;
    // start line numbers at 10:
    this.lineNumber = 10;
    // increment line numbers by 10:
    this.lineNumberIncrement = 10;

    this.outputOffsetPath = true;

    // make sure line number 2 is formatted as "N0002":
    //this.registerVariable("lineNumber", "N", true, "N", 0, { "width":4, "leadingZeroes":true });

    // header:
    this.header = [
        "%",
        "([PROGRAM_NAME])",
        "[N] G92 X0 Y0",
        "[N] G91",
        "[N] G71",
    ];

    // footer:
    this.footer = [
        "[N] M30",
        "%",
    ];

    // ignore tool change:
    this.toolHeader = [];

    this.rapidMove = [
        "[N] G00 [XR] [YR]",
    ];
    this.rapidMoveZ = [];

    this.linearMove = [
        "[N] G01 [XR] [YR]",
    ];
    this.linearMoveZ = [];

    this.arcCWMove = [
        "[N] G02 [XR] [YR] [I] [J]",
    ];

    this.arcCCWMove = [
        "[N] G03 [XR] [YR] [I] [J]",
    ];

    this.firstLinearMove = this.linearMove;
    this.firstLinearMoveZ = this.linearMoveZ;
    this.firstArcCWMove = this.arcCWMove;
    this.firstArcCCWMove = this.arcCCWMove;

    // tool compensation on:
    this.linearMoveCompensationLeft = [
        "[N] G41",
        "[N] M04",
        "[N] G01 [XR] [YR]",
    ];
    this.linearMoveCompensationRight = [
        "[N] G42",
        "[N] M04",
        "[N] G01 [XR] [YR]",
    ];
    // tool compensation off:
    this.linearMoveCompensationOff = [
        "[N] G01 [XR] [YR]",
        "[N] M03",
        "[N] G40",
    ];
}

// Configuration is derived from GCodeBase:
GCodePlasmaMM.prototype = new GCodeBase();

// Display name shown in user interface:
GCodePlasmaMM.displayName = "G-Code Plasma [mm]";
