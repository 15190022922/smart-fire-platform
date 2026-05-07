// For Heidenhain TNC150 on Bridgeport Interact 1 MK2
// Reho Engineering 2024
// Version: 0.3
// Last changed: 22-04-2024

include("GCodeBase.js");

// Constructor of class Tnc150MM
function Tnc150MM(cadDocumentInterface, camDocumentInterface) {
    GCodeBase.call(this, cadDocumentInterface, camDocumentInterface);

    this.decimals = 3;
    this.options = {
        sign: true,
        decimalSeparator: ",",
        trailingZeroes: true
    };

    this.unit = RS.Millimeter;
    this.fileExtensions = [ "nc" ];
    this.splitFullCircles = false;
    this.lineNumber = 0;
    this.lineNumberIncrement = 1;
    this.outputOffsetPath = true;

    this.header = [
        "[N#] BEGIN PGM [PROGRAM_NAME] MM",
        // goto toolchange location
        // need to change this for measuring individual tool length 
        // and entering the value into the nc
        "[N#] LBL1",
        "[N#] TOOL CALL 0 Z S 40",
        "[N#] L [ZH] R0 F9999 M05",
        "[N#] L [XH] [YH] R0 F9999 M05",
        // temporary halt program for changing tool
        "[N#] STOP M25",
        "[N#] LBL 0"
    ];
    this.footer = [
        // call M25 to end the program
        // "[N#] STOP M25",
        "[N#] END PGM [PROGRAM_NAME] MM"
    ];

    this.toolHeader = [
       // call tool # with defined speed
       "[N#] TOOL CALL [T#] Z [S]"
    ];

    this.toolFooter = [
       // move to toolchange position and wait
       "[N#] CALL LBL 1 REP"
    ];

    // header / footer before / after each toolpath (can be multiple contours):
    this.toolpathHeader = []; 
    this.toolpathFooter = [];
   
    this.rapidMove = [
        // move and start spinde in CW rotation, no cooling
        "[N#] L [X] [Y] R0 F9999 M03"
    ];
    this.rapidMoveZ = [
        // move and start spinde in CW rotation, no cooling
        "[N#] L [Z] R0 F9999 M03"
    ];

    this.linearMove = [
        // move and start spinde in CW rotation, no cooling
        "[N#] L [X] [Y] R0 F[F#] M03"
    ];
    this.linearMoveZ = [
        // move and start spinde in CW rotation, no cooling
        "[N#] L [Z] R0 F[FP#] M03"
    ];

    this.arcCWMove = [
        "[N#] CC X[IA#] Y[JA#]",
        "[N#] C [X] [Y] DR- R0 F[F#] M03"
    ];

    this.arcCCWMove = [
        "[N#] CC X[IA#] Y[JA#]",
        "[N#] C [X] [Y] DR+ R0 F[F#] M03"
    ];

    this.firstLinearMove = this.linearMove;
    this.firstLinearMoveZ = this.linearMoveZ;
    this.firstArcCWMove = this.arcCWMove;
    this.firstArcCCWMove = this.arcCCWMove;

    // these are not checked 
    this.linearMoveCompensationLeft = [ "[N#] L [X] [Y] R+ [F] M"];
    this.linearMoveCompensationRight = [ "[N#] L [X] [Y] R- [F] M"];
    this.linearMoveCompensationOff = [ "[N#] L [X] [Y] R0 [F] M"];
}

// Class Tnc150MM is inherited from GCodeBase
Tnc150MM.prototype = new GCodeBase();

// Static property of class Tnc150MM (keep below constructor)
Tnc150MM.displayName = "Heidenhain TNC150 [mm]";

Tnc150MM.prototype.writeHeader = function() {
    // write regular header as defined in this.header variable:
    this.writeBlock("header");

    // backup member variables:
    var tool = this.tool;
    var toolDiameter = this.toolDiameter;
    var toolRadius = this.toolRadius;

    // write list of tools with tool radius
    var toolNames = Cam.getToolNames(this.cadDocument);
    toolNames.sort(Array.alphaNumericalSorter);
    for (var i=0; i<toolNames.length; i++) {
        var toolName = toolNames[i];

        // temporarily overwrite member variables:
        this.tool = toolName;
        this.toolDiameter = Cam.getToolDiameter(this.cadDocument, toolName, 0.0);
        this.toolRadius = this.toolDiameter/2;

        // write tool definition to output file:
        this.writeBlockFromString("[N#] TOOL DEF [T#] L+0,000 R[TR#]");
    }

    // restore member variables:
    this.tool = tool;
    this.toolDiameter = toolDiameter;
    this.toolRadius = toolRadius;
};
