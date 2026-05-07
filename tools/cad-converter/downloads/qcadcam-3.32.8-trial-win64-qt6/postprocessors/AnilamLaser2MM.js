 /**
 * This file is part of the QCAD/CAM software.
 * This file is a modified version of GCodeLaserOffsetMM.js postprocessor file. 
 * Modified by Arctic_Eddie and corrected/improved by CVH.
 * You can edit this file. Be sure to put a copy someplace safe for the next update.
 * Copy this file into QCADCAM\postprocessors.
 * For details, please refer to the file README.txt in this directory.
 */
include("AnilamLaser.js");

/**
 * Switch laser on / off, disable tool changes.
 */
function AnilamLaser2MM(documentInterface, camDocumentInterface) {
    AnilamLaser.call(this, documentInterface, camDocumentInterface);

    this.decimals = 2;                       // Anilam doesn't like more than two digits
    this.unit = RS.Millimeter;
// Not needed here, turned off(false) in AnilamLaser.js
//    this.outputOffsetPath = false;         // Not needed since QCAM calculates the offset

// Make circular I & J absolute for Anilam only:
/*  Ruled out
    this.firstArcCWMove =                    "[N] G2 [X] [Y] [IA] [JA] [F]";
    this.arcCWMove =                         "[N] G2 [X] [Y] [IA] [JA] [F]";

    this.firstArcCCWMove =                   "[N] G3 [X] [Y] [IA] [JA] [F]";
    this.arcCCWMove =                        "[N] G3 [X] [Y] [IA] [JA] [F]";
*/

// Make circular I & J relative and readable by Anilam and NCViewer:
    this.firstArcCWMove =                    "[N] G2 [X] [Y] G91 [I] [J] G90 [F]";
    this.arcCWMove =                         "[N] G2 [X] [Y] G91 [I] [J] G90 [F]";

    this.firstArcCCWMove =                   "[N] G3 [X] [Y] G91 [I] [J] G90 [F]";
    this.arcCCWMove =                        "[N] G3 [X] [Y] G91 [I] [J] G90 [F]";

    this.header = [
        "",
        "%",                                 // Signal to Anilam that text will follow
        "",
        "[N] G71 G90 G40 F500",              // Millimeter, absolute, no offset, fast home
        "[N] G0 X0 Y0 Z0"                    // Home
    ];

    this.footer = [
        "[N] F500",                          // Speed it up
        "[N] G0 X0 Y0 Z0",                   // Home
        "[N] G26E",                          // End program
        "",
        "%",                                 // End program input
        "%"                                  // Sometimes needs two %
    ];
};

AnilamLaser2MM.prototype = new AnilamLaser();
AnilamLaser2MM.displayName = "Anilam Laser2 [mm]";
