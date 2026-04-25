const SUPABASE_URL = "https://sbtilghzgtuyrjtkuhtt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vOpsvZGwgBU5rTfcJ63tjQ_8Rx_8NWI";

if (
  SUPABASE_URL.includes("https://sbtilghzgtuyrjtkuhtt.supbase.co") ||
  SUPABASE_ANON_KEY.includes("sb_publishable_vOpsvZGwgBU5rTfcJ63tjQ_8Rx_8NWI")
) {
  console.warn("Add your Supabase project URL and anon key in script.js before using the form.");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById("enrollment-form");
const submitButton = document.getElementById("submit-button");
const statusElement = document.getElementById("form-status");
const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.18
  });

  revealElements.forEach((element) => {
    revealObserver.observe(element);
  });
} else {
  revealElements.forEach((element) => {
    element.classList.add("is-visible");
  });
}

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = "form-status";

  if (type) {
    statusElement.classList.add(`is-${type}`);
  }
}

function createFilePath(folderName, file) {
  const timestamp = Date.now();
  const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  return `${folderName}/${timestamp}-${safeName}`;
}

async function uploadFile(file, folderName) {
  const filePath = createFilePath(folderName, file);

  const { error: uploadError } = await supabaseClient.storage
    .from("enrollments")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from("enrollments")
    .getPublicUrl(filePath);

  return {
    path: filePath,
    // This returns a public URL, so the bucket should allow public file access.
    url: publicUrlData.publicUrl
  };
}

function buildEnrollmentPayload(formData, studentCardUpload, certificateUpload) {
  return {
    name: formData.get("name"),
    email: formData.get("email"),
    phone_number: formData.get("phone"),
    university: formData.get("university"),
    year_of_study: formData.get("year_of_study"),
    chosen_axis: formData.get("chosen_axis"),
    hobbies_and_skills: formData.get("hobbies_skills"),
    motivation: formData.get("motivation"),
    student_card_url: studentCardUpload.url,
    student_card_path: studentCardUpload.path,
    scholar_certificate_url: certificateUpload.url,
    scholar_certificate_path: certificateUpload.path
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const studentCardFile = formData.get("student_card");
  const certificateFile = formData.get("scholar_certificate");

  if (!(studentCardFile instanceof File) || studentCardFile.size === 0) {
    setStatus("Please upload a student card image.", "error");
    return;
  }

  if (!(certificateFile instanceof File) || certificateFile.size === 0) {
    setStatus("Please upload a scholar certificate PDF.", "error");
    return;
  }

  if (!certificateFile.name.toLowerCase().endsWith(".pdf")) {
    setStatus("The scholar certificate must be a PDF file.", "error");
    return;
  }

  submitButton.disabled = true;
  setStatus("Uploading files and sending your enrollment...", "");

  try {
    const studentCardUpload = await uploadFile(studentCardFile, "student-cards");
    const certificateUpload = await uploadFile(certificateFile, "scholar-certificates");

    const payload = buildEnrollmentPayload(
      formData,
      studentCardUpload,
      certificateUpload
    );

    const { error: insertError } = await supabaseClient
      .from("enrollments")
      .insert([payload]);

    if (insertError) {
      throw insertError;
    }

    form.reset();
    setStatus("Enrollment submitted successfully.", "success");
  } catch (error) {
    console.error("Enrollment submission failed:", error);
    setStatus(error.message || "Something went wrong. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
  }
});
