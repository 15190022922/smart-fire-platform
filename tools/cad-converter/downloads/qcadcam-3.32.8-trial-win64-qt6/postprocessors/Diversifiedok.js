include("LaserBase.js");

function Diversifiedok(cadDocumentInterface, camDocumentInterface) {
    LaserBase.call(this, cadDocumentInterface, camDocumentInterface, false);

    this.fileExtensions = [ "tap" ];

    // for computed kerf offset:
    this.outputOffsetPath = true;

    this.decimals = 4;
    this.unit = RS.Millimeter;

    // stop cutting at tab:
    this.stopAtTab = true;

    // header:
    this.header = [
        "[N] G20",
        "[N] G53 G90 G91.1 G40",
        "[N] F1",
        "[N] S500",
        "[N] M06 T1 F70.0"
    ];

    // footer:
    this.footer = [
        "[N] M05 M30"
    ];

    // Mach3 has G40 on separate line,
    // followed by a G1 with the position to move to:
    this.linearMoveCompensationOff = [
        "[N] G40",
        "[N] G1 [X] [Y]"
    ];

    // before every contour or pass, switch on laser (M03) and dwell (G04)
    this.zPassHeader = [
        "[N] M03",
        "[N] G04 P0.5"
    ];
    this.zPassFirstHeader = this.zPassHeader;

    // after every contour or pass, switch off laser (M05):
    this.zPassFooter = [
        "[N] M05"
    ];
    this.zPassLastFooter = this.zPassFooter;
}

Diversifiedok.prototype = new LaserBase();

Diversifiedok.displayName = "Diversifiedok [in]";

