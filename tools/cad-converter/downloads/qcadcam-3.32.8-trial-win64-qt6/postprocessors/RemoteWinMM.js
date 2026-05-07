include("GCodeMM.js");

function RemoteWinMM(documentInterface, camDocumentInterface) {
    GCodeMM.call(this, documentInterface, camDocumentInterface);

    this.outputOffsetPath = true;
    this.decimals = 4;
    this.options = {
        trailingZeroes: true
    };
    this.fileExtensions = [ "iso" ];

    // this sets the line ending to CR/LF (0x0D/0x0A):
    this.lineEnding = "\r\n";

    this.header = [
        "G90",
        "G94"
    ];

    this.footer = [
        "M05",
        "M0"
    ];

    this.toolHeader = [
        "M5",
        // is this a fixed position used for tool changes?
        // is it the first position of the profile?
        // not needed at all?
        //"G00 Z25.4000",
        //"G00 X400.0000 Y10.0000",
        "[T]",
        "M6",
        "(MSG, Change to Tool Dia = [TD])",
        "M01",
        "M03 [S]"
    ];

    this.rapidMove = [
        "G00 [X] [Y]"
    ];
    this.rapidMoveZ = [
        "G00 [Z]"
    ];

    this.firstLinearMove = [
        "G01 [X] [Y] [F]"
    ];
    this.linearMove = [
        "G01 [X] [Y] [F]"
    ];

    this.firstLinearMoveZ = [
        "G01 [Z] [F]"
    ];
    this.linearMoveZ = [
        "G01 [Z] [F]"
    ];

    // point moves for drilling:
    this.firstPointMoveZ = this.firstLinearMoveZ;
    this.pointMoveZ = this.linearMoveZ;

    // circular moves:
    this.firstArcCWMove = [
        "G02 [X] [Y] [I] [J] [F]"
    ];
    this.arcCWMove = [
        "G02 [X] [Y] [I] [J] [F]"
    ];

    this.firstArcCCWMove = [
        "G03 [X] [Y] [I] [J] [F]"
    ];
    this.arcCCWMove = [
        "G03 [X] [Y] [I] [J] [F]"
    ];

}

RemoteWinMM.prototype = new GCodeMM();
RemoteWinMM.displayName = "RemoteWin (Offset) [mm]";

// an override here might be needed if the tool header uses a fixed position:
//RemoteWinMM.prototype.writeToolHeader = function() {
//    this.writeBlock("toolHeader");
//    this.xPosition = 400.0;
//    this.yPosition = 10.0;
//};
