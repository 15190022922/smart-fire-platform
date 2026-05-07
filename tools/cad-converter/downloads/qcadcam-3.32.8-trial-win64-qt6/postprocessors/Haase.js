// Include definition of class GCodeMM:
// Author: ThorstenW
include("GCodeMM.js");

// Constructor:
function Haase(cadDocumentInterface, camDocumentInterface) {
    GCodeMM.call(this, cadDocumentInterface, camDocumentInterface);

    this.decimals = 3;
    this.options = {
        trailingZeroes: true
    };

    this.outputOffsetPath = true;
    this.alwaysWriteG1 = true;

    //this.rapidMoveZ = [];
    //this.linearMoveZ = [];
   //this.firstLinearMoveZ = [];
   // this.firstPointMoveZ = [];

   // this.rapidMove = [];

    this.lineNumber = 110;

    // keep track of toolpath header, skip first:
    this.firstToolpathHeader = true;

    // tool description (used for tool changes, e.g. "(End Mill {6mm})")
    this.registerVariable("toolDescription", "TDESC", true,  "", 0);
    this.registerVariable("toolpathDescription", "TPDESC", true,  "", 0);

    this.registerVariable("feedRate",            "F",                    false, "F", 1, this.options);
    this.registerVariable("plungeRate",          "FP",                   false, "F", 1, this.options);

    this.header = [
        "( [FILENAME] )",
        "( File created: [DATETIME])",
        "( Haase Boening CNC 2)",
        "()",
        "[N] G00 G21 G17 G90 G40 G49",
        "[N] G80",
        "[N] ([TDESC])",
	"[N] [T]",
        "[N] G00 G43 H[T#]",
        "[N] [S] M03",
        "[N] (Toolpath:- [TPDESC])",
	"[N] M08",
        "[N] G94"
        //"[N] [XH] [YH] [F]"
    ];



// Werkzeugwechsel
this.toolHeader = [
	"[N] M09",
	"[N] ([TDESC])",
	"[N] [T]",
	"[N] M08",
	"[N] G0 [X!] [Y!]"
    ];

    this.toolpathHeader = [
	"([TPDESC])",
        "[N] [S] M03"
        
    ];




// Schnelles Anfahren der ersten Position der ersten Kontur
this.rapidMove = [
	"[N] G0 [X!] [Y!]",
        "[N] G0 [ZU!]"
];


this.rapidMoveZ = [
	//"[N] G0 [ZU!]"
];


this.linearMoveZ = [
  	//"[N] G0 [ZU!]"
];

this.singleZPassFooter = [
       "[N] G0 [ZU!]"
];







 

 

    this.footer = [
        "[N] M09",
        "[N] M30",
        "%"
    ];

    this.firstLinearMove =           "[N] G1 [X!] [Y!] [F!]";
    this.linearMove =                this.firstLinearMove;

    this.firstArcCWMove =            "[N] G2 [X!] [Y!] [I!] [J!] [F!]";
    this.arcCWMove =                 this.firstArcCWMove;

    this.firstArcCCWMove =           "[N] G3 [X!] [Y!] [I!] [J!] [F!]";
    this.arcCCWMove =                this.firstArcCCWMove;
}

// Configuration is derived from GCodeMM:
Haase.prototype = new GCodeMM();

// Display name shown in user interface:
Haase.displayName = "BOENIGK cncGraF Haase (Offset) [mm]";
Haase.description = "Haase AL-Serie, BOENIGK cncGraF";

/**
 * Initialize additional variables.
 */
Haase.prototype.initToolpath = function(toolpathBlock) {
    GCodeBase.prototype.initToolpath.call(this, toolpathBlock);

    this.toolDescription = this.toolBlock.getCustomProperty("QCAD", "CamDescription", "");
    this.toolpathDescription = Cam.getToolpathName(this.currentToolpathBlock.getName());
};

Haase.prototype.isIgnoredForWrite = function(entity) {
    // ignore all rapid moves:
//    if (entity.hasCustomProperty("QCAD", "CamRapidMove")) {
//        return true;
//    }

//    var toolName = entity.getCustomProperty("QCAD", "CamTool");
//    var toolType = Cam.getToolType(entity.getDocument(), toolName, undefined);
//    if (toolType===Cam.ToolType.Drill) {
//        return false;
//    }

//    // ignore all (other) vertical moves (handled in header / footer blocks):
//    var sp = entity.getStartPoint();
//    var ep = entity.getEndPoint();
//    if (sp.equalsFuzzy2D(ep)) {
//        return true;
//    }

    return false;
};

Haase.prototype.initEntity = function(entity) {
    GCodeBase.prototype.initEntity.call(this, entity);

    // force plunge rate from toolpath:
    this.plungeRate = this.getToolpathOptionFloat("CamPlungeRate", 0.0);

//    // force Z safety from document configuration:
    var zSafetyString = this.camDocument.getVariable(Cam.getCurrentVariablePrefix() + "CamZSafety", 20.0);
    this.zSafety = parseFloat(zSafetyString);
};

/**
 * Defines the template string for the tool name (e.g. "Tool 1 {6mm}").
 */
Haase.prototype.getToolTypeTitleTemplate = function(toolType) {
    var name = this.getToolTypeTitle(toolType);
    return name + " {%1}";
};

Haase.prototype.writeBlock = function(name) {
    var toolpathHeader = [];
    if (name==="toolpathHeader" && this.firstToolpathHeader) {
        toolpathHeader = this.toolpathHeader;
        this.toolpathHeader = [];
    }

    GCodeBase.prototype.writeBlock.call(this, name);

    if (name==="toolpathHeader") {
        // keep feedrate up to date:
        this.variables["F"].previous = this.formatValue(this.plungeRate, 3, this.options);
    }

    if (name==="toolpathHeader" && this.firstToolpathHeader) {
        this.toolpathHeader = toolpathHeader;
        this.firstToolpathHeader = false;
    }
};



Haase.prototype.initDialog = function(dialog, di, resourceBlock) {
    // adjust profile toolpath dialog:
    if (dialog.objectName==="CamProfileToolpathDialog") {
        // change default cutting depth:

        var leCuttingDepth = dialog.findChild("CamZCuttingDepth");
        leCuttingDepth.setValue(3.5);

        // change default side:
        // var cbSide = dialog.findChild("CamSide");
        // cbSide.setValue(2); // 0: none, 1: outside, 2: inside
	// cbSide.selectedIndex(2);

    }
};



