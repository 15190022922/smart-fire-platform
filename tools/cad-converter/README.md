# Platform CAD Converter

This directory is the platform-owned CAD conversion layer. Tenant users do not install anything.

## Runtime contract

The application calls:

```text
node tools/cad-converter/cad-converter.mjs <sourceCadPath> <outputDir>
```

The wrapper must generate:

```text
<outputDir>/scene.svg
```

It may also generate:

```text
<outputDir>/preview.png
<outputDir>/conversion-log.txt
```

## Lookup Order

The platform looks for a converter in this order:

1. `tools/cad-converter/bin/<platform>/`
2. `PATH` and common local install directories such as QCAD under Program Files
3. Optional operations override: `CAD_CONVERTER_BIN`

If none of these are available, CAD upload is saved but marked as conversion failed. The user should upload a PDF export or ask the platform administrator to install the converter kernel.

## Bundled Binaries

Put QCAD Command Line Tools or compatible converters here during deployment:

```text
tools/cad-converter/bin/windows/dwg2svg.exe
tools/cad-converter/bin/linux/dwg2svg
tools/cad-converter/bin/macos/dwg2svg
```

For the current Windows-first setup, an unpacked QCAD / QCADCAM package may also be placed under:

```text
tools/cad-converter/bin/windows/QCAD/
```

The wrapper scans the platform directory and its direct child directories, so `dwg2svg.bat` inside that QCAD folder is detected automatically.

For DXF-only converters you may also provide `dxf2svg`; otherwise `dwg2svg` is used for both DWG and DXF.

The repository does not include commercial CAD binaries. They must be added by the platform deployment package according to the converter license.

## Check

```bash
npm run cad:check
```

If the converter is not detected automatically, operations may use `CAD_CONVERTER_BIN` and `CAD_CONVERTER_ARGS` as a fallback override.

Large CAD drawings can take several minutes. The application default timeout is 900000 ms and can be changed with `CAD_CONVERTER_TIMEOUT_MS`.
