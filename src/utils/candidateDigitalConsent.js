const { jsPDF } = require("jspdf");
const { savePdf } = require("./cloudImageSave");

module.exports = {
  candidateDigitalConsent: async (
    applicantName = "Demo Applicant",
    pdfFileName = "applicant_authorization.pdf",
    targetDirectory = "pdfs"
  ) => {
    return new Promise((resolve, reject) => {
      try {
        const doc = new jsPDF({ compress: true });
        let marginLeft = 10;
        let marginTop = 20;
        let lineHeight = 10;
        let maxWidth = 180;

        doc.setFontSize(14);
        doc.text("APPLICANT AUTHORIZATION AND DIGITAL CONSENT", marginLeft, marginTop);
        
        marginTop += lineHeight * 2;
        doc.setFontSize(12);
        doc.text(`From: ${applicantName}`, marginLeft, marginTop);
        marginTop += lineHeight;
        doc.text("To: Screeningstar Solutions Pvt Ltd", marginLeft, marginTop);
        marginTop += lineHeight;
        doc.text("(An ISO 27001:2013 Certified Organisation)", marginLeft, marginTop);

        marginTop += lineHeight * 2;
        doc.setFontSize(10);
        const authorizationText = [
          "I understand that the information provided by me may be used by the organisation or its partner agency to verify and validate the information.",
          "I authorize, without reservation, any individual, corporation, or other private or public entity to furnish the organisation or its partner agency the above-mentioned information about me.",
          "I unconditionally release and hold harmless any individual, corporation, or private or public entity from any and all causes of action that might arise from furnishing to the organisation or its partner agency that they may request pursuant to this release.",
          "This authorization and release, in original, electronic form, faxed or photocopied form, shall be valid for this and any future reports and updates that may be requested.",
          "This is a digitally generated document and signature won't be required."
        ];

        authorizationText.forEach((text) => {
          doc.text(text, marginLeft, marginTop, { maxWidth });
          marginTop += lineHeight * 2;
        });

        marginTop += lineHeight;
        doc.setFontSize(12);
        const currentDate = new Date().toISOString().split("T")[0];
        const currentTime = new Date().toLocaleTimeString();
        doc.text(`Date: ${currentDate}`, marginLeft, marginTop);
        marginTop += lineHeight;
        doc.text(`Time: ${currentTime}`, marginLeft, marginTop);

        // Save the PDF to cloud storage
        const pdfPathCloud = savePdf(doc, pdfFileName, targetDirectory);
        resolve(pdfPathCloud);
      } catch (error) {
        console.error("Error generating PDF:", error);
        reject(new Error("Failed to generate Applicant Authorization PDF."));
      }
    });
  },
};
