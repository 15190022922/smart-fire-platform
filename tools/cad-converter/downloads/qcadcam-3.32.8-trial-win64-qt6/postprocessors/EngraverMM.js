include("LinuxCNC.js");

function EngraverMM(cadDocumentInterface, camDocumentInterface) {
    LinuxCNC.call(this, cadDocumentInterface, camDocumentInterface);

    this.decimals = 3;
    this.unit = RS.Millimeter;
    this.fileExtensions = ["gcode"];
    this.zHomePosition = 0;
    this.lineNumber = 1;
    this.lineNumberIncrement = 1;
    this.header = [
        "[N] $H"
    ];

    this.toolHeader = ["[N] M3 [S]"];
    this.toolFooter = ["[N] M5"];
    this.linearMove = ["[N] G1 [X!] [Y!] [F!]"];
    this.linearMoveZ = ["[N] G1 [Z] [F!]"];

    this.firstArcCWMove =            "[N] G2 [X!] [Y!] [I!] [J!] [F!]";
    this.arcCWMove =                 "[N] G2 [X!] [Y!] [I!] [J!] [F!]";

    this.firstArcCCWMove =           "[N] G3 [X!] [Y!] [I!] [J!] [F!]";
    this.arcCCWMove =                "[N] G3 [X!] [Y!] [I!] [J!] [F!]";

    this.footer = [
        "[N] $H",
        "[N] M30",
        "[N] $SLP"
    ];
}

EngraverMM.prototype = new LinuxCNC();

EngraverMM.displayName = "Engraver [mm]";
