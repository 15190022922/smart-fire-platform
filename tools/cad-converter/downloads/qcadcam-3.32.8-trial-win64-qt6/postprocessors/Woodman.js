// Include definition of class GCodeMM:
include("GCodeMM.js");

// Constructor:
function Woodman(cadDocumentInterface, camDocumentInterface) {
    GCodeMM.call(this, cadDocumentInterface, camDocumentInterface);

    this.decimals = 3;
    this.options = {
        trailingZeroes: true
    };

    this.outputOffsetPath = true;
    this.alwaysWriteG1 = true;

    this.rapidMoveZ = [];
    this.linearMoveZ = [];
    this.firstLinearMoveZ = [];
    this.firstPointMoveZ = [];

    this.rapidMove = [];

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
        "( Woodman SD6090 Postprocessor )",
        "()",
        "[N]G00G21G17G90G40G49",
        "[N]G80",
        "[N] ([TDESC])",
        "[N]G00G43[ZS!]H[T#]",
        "[N][S]M03",
        "[N](Toolpath:- [TPDESC])",
        "[N]()",
        "[N]G94",
        "[N][XH][YH][F]"
    ];

    // no tool changes (?)
    this.toolHeader = [
    ];

    this.toolpathHeader = [
        "[N][S]M03",
        "([TPDESC])",
        "()"
    ];

    this.contourHeader = [
         "[N]G00[X1][Y1][ZU!]",
         "[N]G1[ZD!][FP!]"
    ];

    this.contourFooter = [
         "[N]G00[ZU!]",
    ];

    this.toolpathFooter = [
    ];

    this.toolFooter = [
    ];

    this.footer = [
        "[N]G00[ZH!]",
        "[N]G00[XH][YH]",
        "[N]M09",
        "[N]M30",
        "%"
    ];

    this.firstLinearMove =           "[N]G1[X][Y][F]";
    this.linearMove =                this.firstLinearMove;

    this.firstArcCWMove =            "[N]G2[X][Y][I][J][F]";
    this.arcCWMove =                 this.firstArcCWMove;

    this.firstArcCCWMove =           "[N]G3[X][Y][I][J][F]";
    this.arcCCWMove =                this.firstArcCCWMove;
}

// Configuration is derived from GCodeMM:
Woodman.prototype = new GCodeMM();

// Display name shown in user interface:
Woodman.displayName = "Woodman SD6090 (Offset) [mm]";
Woodman.description = "Woodman SD6090";

/**
 * Initialize additional variables.
 */
Woodman.prototype.initToolpath = function(toolpathBlock) {
    GCodeBase.prototype.initToolpath.call(this, toolpathBlock);

    this.toolDescription = this.toolBlock.getCustomProperty("QCAD", "CamDescription", "");
    this.toolpathDescription = Cam.getToolpathName(this.currentToolpathBlock.getName());
};

Woodman.prototype.isIgnoredForWrite = function(entity) {
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

Woodman.prototype.initEntity = function(entity) {
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
Woodman.prototype.getToolTypeTitleTemplate = function(toolType) {
    var name = this.getToolTypeTitle(toolType);
    return name + " {%1}";
};

Woodman.prototype.writeBlock = function(name) {
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
