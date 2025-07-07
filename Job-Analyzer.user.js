// ==UserScript==
// @name         LinkedIn and SEEK Job Analyzer
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Automatically analyze LinkedIn and SEEK job postings to extract requirements, tech stack, and citizenship details
// @author       lemontea
// @match        https://*.linkedin.com/jobs/*
// @match        https://*.linkedin.com/job/*
// @match        https://linkedin.com/jobs/*
// @match        https://www.seek.com.au/*-jobs/*
// @match        https://www.seek.com.au/job/*
// @match        https://www.seek.com.au/*?jobId=*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  console.log("LinkedIn/SEEK Job Analyzer loading...");

  // Global variable to track the current job ID
  let currentJobId = null;
  let analysisWindow = null;
  let currentPlatform = null; // 'linkedin' or 'seek'

  // Initialize when page loads
  function initialize() {
    // Add small button for re-analysis (still useful sometimes)
    addSmallAnalyzeButton();

    // Detect which platform we're on
    detectPlatform();

    // Setup observer to detect job changes
    setupJobChangeObserver();

    // Try to analyze current job
    checkAndAnalyzeCurrentJob();

    // Periodically check if job has changed
    setInterval(checkAndAnalyzeCurrentJob, 2000);
  }

  // Detect if we're on LinkedIn or SEEK
  function detectPlatform() {
    const url = window.location.href;
    if (url.includes("linkedin.com")) {
      currentPlatform = "linkedin";
    } else if (url.includes("seek.com.au")) {
      currentPlatform = "seek";
    }
    console.log(`Current platform detected as: ${currentPlatform}`);
  }

  // Add a small, less intrusive button
  function addSmallAnalyzeButton() {
    // Remove any existing button first
    const existingButton = document.getElementById("job-analyzer-mini");
    if (existingButton) {
      existingButton.remove();
    }

    // Create a new button element
    const button = document.createElement("button");
    button.id = "job-analyzer-mini";
    button.innerHTML = "🔄";
    button.title = "Re-analyze job";

    // Style it to be small and non-intrusive
    button.style.position = "fixed";
    button.style.right = "10px";
    button.style.top = "10px";
    button.style.zIndex = "2147483647";
    button.style.backgroundColor = "#0a66c2";
    button.style.color = "white";
    button.style.width = "30px";
    button.style.height = "30px";
    button.style.borderRadius = "50%";
    button.style.border = "none";
    button.style.fontSize = "14px";
    button.style.cursor = "pointer";
    button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    button.style.opacity = "0.7";
    button.style.transition = "opacity 0.2s ease";

    // Hover effect
    button.onmouseover = function () {
      this.style.opacity = "1";
    };
    button.onmouseout = function () {
      this.style.opacity = "0.7";
    };

    // Add click event
    button.addEventListener("click", function () {
      // Remove existing analysis window if present
      if (analysisWindow) {
        analysisWindow.remove();
        analysisWindow = null;
      }

      // Perform new analysis
      analyzeJob();
    });

    // Add to document body
    document.body.appendChild(button);
  }

  // Setup observer to detect when job content changes
  function setupJobChangeObserver() {
    // Create a mutation observer to watch for URL changes
    const observer = new MutationObserver(function (mutations) {
      checkAndAnalyzeCurrentJob();
    });

    // Start observing
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });
  }

  // Check if current job has changed and analyze if it has
  function checkAndAnalyzeCurrentJob() {
    const currentURL = window.location.href;
    let jobIdMatch = null;
    let jobId = null;

    // Different URL pattern matching based on platform
    if (currentPlatform === "linkedin") {
      jobIdMatch = currentURL.match(/currentJobId=(\d+)/);
      if (jobIdMatch) {
        jobId = jobIdMatch[1];
      }
    } else if (currentPlatform === "seek") {
      // Try to match SEEK job ID patterns
      // Pattern 1: URLs with jobId parameter
      jobIdMatch = currentURL.match(/jobId=(\d+)/);
      if (jobIdMatch) {
        jobId = jobIdMatch[1];
      }

      // Pattern 2: URLs with job/<jobid> pattern
      if (!jobId) {
        const jobPathMatch = currentURL.match(/\/job\/(\d+)/);
        if (jobPathMatch) {
          jobId = jobPathMatch[1];
        }
      }

      // If we still don't have a job ID, but we're on a job page, use the URL as an identifier
      if (
        !jobId &&
        (currentURL.includes("/job/") || currentURL.includes("?jobId="))
      ) {
        // Use the entire URL (without query params) as a unique identifier
        jobId = "url:" + currentURL.split("?")[0];
      }
    }

    // If we have a job ID and it's different from current
    if (jobId && jobId !== currentJobId) {
      console.log(`Job changed from ${currentJobId} to ${jobId}`);
      currentJobId = jobId;

      // Wait for content to load completely
      setTimeout(() => {
        // Remove existing analysis if present
        if (analysisWindow) {
          analysisWindow.remove();
          analysisWindow = null;
        }

        // Analyze the new job
        analyzeJob();
      }, 1000);
    }
  }

  // Job analysis function
  function analyzeJob() {
    console.log(`Auto-analyzing current job on ${currentPlatform}`);

    try {
      // Get job description text
      const jobText = extractJobText();

      if (!jobText) {
        showMessage(
          "Could not find job description text. Will retry soon.",
          true
        );
        return;
      }

      // Parse requirements
      const citizenshipInfo = checkCitizenshipRequirements(jobText);
      const techStack = extractTechStack(jobText);
      const experience = extractExperienceRequirements(jobText);

      // Display results in window at right side
      showResultsAtRightSide(jobText, citizenshipInfo, techStack, experience);
    } catch (error) {
      console.error("Error analyzing job:", error);
      showMessage("Error analyzing job: " + error.message, true);
    }
  }

  // Show toast message
  function showMessage(message, isError = false) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.padding = "12px 24px";
    toast.style.backgroundColor = isError ? "#f8d7da" : "#d4edda";
    toast.style.color = isError ? "#721c24" : "#155724";
    toast.style.borderRadius = "4px";
    toast.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)";
    toast.style.zIndex = "2147483647";
    toast.style.fontFamily = "Arial, sans-serif";
    toast.style.fontSize = "14px";
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.5s";
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  // Extract job text from the page
  function extractJobText() {
    console.log(`Attempting to extract job text from ${currentPlatform}`);

    if (currentPlatform === "seek") {
      return extractSeekJobText();
    } else {
      // Default to LinkedIn extraction
      return extractLinkedInJobText();
    }
  }

  // Extract job text from LinkedIn
  function extractLinkedInJobText() {
    // LinkedIn-specific selectors
    const selectors = [
      ".jobs-description",
      ".jobs-description-content",
      ".jobs-box__html-content",
      ".description__text",
      ".show-more-less-html__markup",
      ".jobs-description-content__text",
    ];

    let jobText = "";

    // Try each selector
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (
        element &&
        element.textContent &&
        element.textContent.trim().length > 100
      ) {
        jobText = element.textContent.trim();
        console.log(`Found LinkedIn job text using selector: ${selector}`);
        break;
      }
    }

    // If still no text, get any large text block
    if (!jobText) {
      const allDivs = document.querySelectorAll("div");
      for (const div of allDivs) {
        const text = div.textContent.trim();
        if (text.length > 500) {
          jobText = text;
          console.log("Found LinkedIn job text in generic div");
          break;
        }
      }
    }

    return jobText;
  }

  // Extract job text from SEEK
  function extractSeekJobText() {
    // SEEK-specific selectors - refined based on SEEK structure
    const selectors = [
      "[data-automation='jobAdDetails']",
      ".templatetext",
      ".job-details-panel",
      ".job-description",
      "#jobDescription",
      "[data-automation='jobDescription']",
      "[data-automation='jobDescriptionDetails']",
      // Common class names in SEEK listings
      ".FYwKg", // Main job description container
      ".PiERS", // Description container
      ".Wp8nw", // Job description container
    ];

    let jobText = "";

    // Try each selector
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (
        element &&
        element.textContent &&
        element.textContent.trim().length > 100
      ) {
        jobText = element.textContent.trim();
        console.log(`Found SEEK job text using selector: ${selector}`);
        break;
      }
    }

    // If still no text, try to find the job content section
    if (!jobText) {
      // Look for content sections with typical job description
      const contentSelectors = [
        ".YVn9-",
        ".FYwKg",
        ".PiERS",
        ".Wp8nw",
        "[data-automation]",
      ];

      for (const selector of contentSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          for (const div of elements) {
            const text = div.textContent.trim();
            if (text.length > 300) {
              jobText = text;
              console.log(
                `Found SEEK job text using content selector: ${selector}`
              );
              break;
            }
          }
          if (jobText) break;
        }
      }

      // Last resort: get the largest text block on the page
      if (!jobText) {
        let largestTextBlock = "";
        const allDivs = document.querySelectorAll("div");
        for (const div of allDivs) {
          const text = div.textContent.trim();
          if (text.length > largestTextBlock.length && text.length > 400) {
            largestTextBlock = text;
          }
        }

        if (largestTextBlock.length > 400) {
          jobText = largestTextBlock;
          console.log("Found SEEK job text using largest text block approach");
        }
      }
    }

    return jobText;
  }

  // Check for citizenship/PR requirements
  function checkCitizenshipRequirements(text) {
    // Terms related to citizenship/PR requirements - expanded and better categorized
    const citizenshipTerms = {
      // US specific
      us: [
        "must be a U.S. citizen",
        "must be a US citizen",
        "must be United States citizen",
        "U.S. citizenship required",
        "US citizenship required",
        "U.S. citizenship is required",
        "US citizenship is required",
        "US person",
        "U.S. person",
      ],
      // Australia specific
      australia: [
        "Australian citizen",
        "Australian citizenship",
        "Australian Permanent Resident",
        "Australian permanent resident",
        "Australian citizenship or permanent residency",
        "Australian citizenship or PR",
        "citizen or permanent resident of Australia",
      ],
      // Generic citizenship
      general: [
        "must be a citizen",
        "citizenship required",
        "citizenship is required",
        "citizen of",
      ],
      // PR related (be careful with these)
      pr: [
        "Permanent Resident",
        "Permanent Residency",
        "PR holder",
        "PR status",
        "hold PR",
        "PR holder",
        "holding PR",
        "valid PR",
      ],
      // Work authorization
      workAuth: [
        "Authorized to work",
        "Authorization to work",
        "eligible to work",
        "work authorization",
        "legally authorized",
        "legal right to work",
        "right to work",
        "work rights",
        "working rights",
      ],
      // Security clearance
      security: [
        "security clearance",
        "government clearance",
        "baseline clearance",
        "NV1",
        "NV2",
        "positive vetting",
        "secret clearance",
        "top secret",
        "AGSVA clearance",
      ],
    };

    // Exclusion patterns - contexts where PR/citizenship terms should NOT be considered requirements
    const exclusionPatterns = [
      // Company/organization descriptions
      /\b(?:south\s+)?australian\s+(?:government|program|programme|initiative|company|organisation|organization|department|agency|project|scheme|service)/i,
      /\b(?:south\s+)?australian\s+pr(?:ogram|ogramme|oject)/i,
      /\blaunched\s+in\s+\d{4}.*australian/i,
      /\b(?:the\s+)?alternative\s+is\s+a\s+(?:south\s+)?australian/i,

      // PR in non-residency context
      /\bpr\s+(?:agency|firm|company|team|department|marketing|campaign|strategy|professional|public relations)/i,
      /\bpublic\s+relations\b/i,
      /\bpress\s+release\b/i,
      /\bpull\s+request\b/i,
      /\bproject\s+(?:manager|management)/i,

      // General company history/description patterns
      /\b(?:company|organization|firm|business|agency).*(?:australian|founded|established|based)/i,
      /\b(?:founded|established|based|located)\s+in\s+australia/i,
      /\bmultinationals?\s+(?:in|across|throughout)\s+australia/i,
    ];

    // Helper function to get clean context around a match
    function getCleanContext(text, index, termLength) {
      let startPos = Math.max(0, index - 60);
      let endPos = Math.min(text.length, index + termLength + 60);

      // Adjust to word boundaries to avoid cutting words
      if (startPos > 0) {
        const beforeStartPos = text.substring(0, startPos);
        const lastSpace = beforeStartPos.lastIndexOf(" ");
        if (lastSpace !== -1) startPos = lastSpace + 1;
      }

      if (endPos < text.length) {
        const afterEndPos = text.substring(endPos);
        const firstSpace = afterEndPos.indexOf(" ");
        if (firstSpace !== -1) endPos += firstSpace;
      }

      let context = text.substring(startPos, endPos).trim();

      // Add ellipsis if we're not at the beginning/end
      if (startPos > 0) context = "..." + context;
      if (endPos < text.length) context = context + "...";

      return context;
    }

    // Helper function to check if a match should be excluded
    function shouldExclude(text, matchIndex, termLength) {
      // Get a larger context around the match for exclusion checking
      let contextStart = Math.max(0, matchIndex - 150);
      let contextEnd = Math.min(text.length, matchIndex + termLength + 150);
      const contextText = text.substring(contextStart, contextEnd);

      // Check against exclusion patterns
      for (const pattern of exclusionPatterns) {
        if (pattern.test(contextText)) {
          return true;
        }
      }

      return false;
    }

    // Flatten the categories for checking
    const allTerms = [].concat(...Object.values(citizenshipTerms));

    // Check for each term
    for (const term of allTerms) {
      // Skip PR-only checks if not in proper context
      if (
        term === "PR holder" ||
        term === "PR status" ||
        term === "hold PR" ||
        term === "valid PR"
      ) {
        // Only check for standalone "PR" when in proper context
        const prRegex =
          /\b(PR)\b(?!\s*(?:agency|firm|professional|public relations|pull request|program|programme|project))/i;
        const matches = [...text.matchAll(new RegExp(prRegex, "gi"))];

        for (const match of matches) {
          const matchIndex = match.index;

          // Check if this match should be excluded
          if (shouldExclude(text, matchIndex, 2)) {
            continue;
          }

          // Additional context check for PR - look for job requirement context
          const contextStart = Math.max(0, matchIndex - 100);
          const contextEnd = Math.min(text.length, matchIndex + 2 + 100);
          const contextText = text.substring(contextStart, contextEnd);

          // Look for job requirement indicators
          const requirementIndicators = [
            /\b(?:must|need|require|should|eligibility|eligible|candidate|applicant).*PR\b/i,
            /\bPR\b.*(?:required|mandatory|essential|necessary|needed)/i,
            /\b(?:citizen|citizenship|residency|resident).*PR\b/i,
            /\bPR\b.*(?:citizen|citizenship|residency|resident)/i,
          ];

          let hasRequirementContext = false;
          for (const indicator of requirementIndicators) {
            if (indicator.test(contextText)) {
              hasRequirementContext = true;
              break;
            }
          }

          if (hasRequirementContext) {
            const context = getCleanContext(text, matchIndex, 2);
            return {
              found: true,
              requirement: "PR (Permanent Resident)",
              context: context,
            };
          }
        }
        continue;
      }

      // Simple text search for other terms
      if (text.toLowerCase().includes(term.toLowerCase())) {
        // Find the context - extract sentence or phrase containing the term
        const lowerText = text.toLowerCase();
        const lowerTerm = term.toLowerCase();
        const index = lowerText.indexOf(lowerTerm);

        // Check if this match should be excluded
        if (shouldExclude(text, index, term.length)) {
          continue;
        }

        // Additional validation for Australian PR specifically
        if (term === "Australian PR") {
          // Look for actual job requirement context
          const contextStart = Math.max(0, index - 100);
          const contextEnd = Math.min(text.length, index + term.length + 100);
          const contextText = text.substring(contextStart, contextEnd);

          // Check if it's about permanent residency vs other meanings
          const prRequirementPatterns = [
            /\b(?:must|need|require|should|eligibility|eligible|candidate|applicant).*australian\s+pr\b/i,
            /\baustralian\s+pr\b.*(?:required|mandatory|essential|necessary|needed)/i,
            /\b(?:citizen|citizenship|residency|resident).*australian\s+pr\b/i,
            /\baustralian\s+pr\b.*(?:citizen|citizenship|residency|resident)/i,
            /\baustralian\s+(?:citizen|citizenship|permanent\s+resident|pr)\b.*(?:required|mandatory|essential|necessary|needed)/i,
          ];

          let hasRequirementContext = false;
          for (const pattern of prRequirementPatterns) {
            if (pattern.test(contextText)) {
              hasRequirementContext = true;
              break;
            }
          }

          if (!hasRequirementContext) {
            continue; // Skip this match as it's likely not a job requirement
          }
        }

        const context = getCleanContext(text, index, term.length);
        return { found: true, requirement: term, context: context };
      }
    }

    return { found: false, requirement: null };
  }

  // Extract tech stack from job description
  function extractTechStack(text) {
    const technologies = [
      // Languages
      "JavaScript",
      "Python",
      "Java",
      "C#",
      "C++",
      "PHP",
      "TypeScript",
      "Ruby",
      "Swift",
      "Kotlin",
      "Go",
      "Rust",
      "Scala",
      "R",
      "MATLAB",
      "Perl",
      "C",
      "C++",
      "C#",
      "Clojure",
      "Elixir",
      "Erlang",
      "F#",
      "Groovy",
      "Haskell",
      "Julia",
      "Lua",

      // Frontend
      "React",
      "Angular",
      "Vue.js",
      "Vue",
      "Svelte",
      "jQuery",
      "HTML",
      "CSS",
      "SASS",
      "SCSS",
      "LESS",
      "Bootstrap",
      "Tailwind",
      "Material UI",
      "Chakra UI",

      // Backend & Frameworks
      "Node.js",
      "Express",
      "Django",
      "Flask",
      "Spring",
      "Laravel",
      "Rails",
      ".NET",
      "ASP.NET",
      "FastAPI",
      "NestJS",
      "Symfony",
      "CodeIgniter",

      // Databases
      "SQL",
      "MySQL",
      "PostgreSQL",
      "SQLite",
      "MongoDB",
      "Firebase",
      "DynamoDB",
      "Cassandra",
      "Redis",
      "Oracle",
      "MS SQL",
      "MariaDB",

      // Cloud & DevOps
      "AWS",
      "Azure",
      "GCP",
      "Google Cloud",
      "Docker",
      "Kubernetes",
      "Jenkins",
      "CI/CD",
      "GitLab",
      "GitHub Actions",
      "Terraform",
      "Ansible",
      "Prometheus",

      // Mobile
      "iOS",
      "Android",
      "React Native",
      "Flutter",
      "Xamarin",
      "Ionic",

      // CMS
      "WordPress",
      "Drupal",
      "Joomla",
      "Shopify",
      "Magento",
      "WooCommerce",

      // Ecommerce
      "Salesforce Commerce Cloud",
      "Big Commerce",
      "Shopify Plus",
      "SAP Commerce",

      // Testing
      "Jest",
      "Mocha",
      "Cypress",
      "Selenium",
      "JUnit",
      "PyTest",
      "TestNG",

      // Data & ML
      "TensorFlow",
      "PyTorch",
      "Pandas",
      "NumPy",
      "scikit-learn",
      "Keras",

      // Tools
      "Git",
      "Jira",
      "Confluence",
      "Trello",
      "Slack",
      "Figma",
      "Adobe XD",

      // Microsoft tools
      "Microsoft 365",
      "M365",
      "Office 365",
      "SharePoint",
      "Power BI",
      "Teams",

      // BI & Data visualization
      "Tableau",
      "Power BI",
      "Looker",
      "Grafana",
      "Kibana",
      "D3.js",
    ];

    const foundTech = [];

    for (const tech of technologies) {
      // Safely escape special characters for regex
      const escapedTech = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      try {
        // Use word boundary when possible for exact matches
        const regex = new RegExp(`\\b${escapedTech}\\b`, "i");
        if (regex.test(text)) {
          foundTech.push(tech);
        }
      } catch (error) {
        // Fallback to simple includes for regex errors
        if (text.toLowerCase().includes(tech.toLowerCase())) {
          foundTech.push(tech);
        }
      }
    }

    return foundTech;
  }

  // Extract experience requirements
  function extractExperienceRequirements(text) {
    try {
      // Look for patterns like "X+ years of experience"
      const expRegexPatterns = [
        /\b(\d+)(?:\+|\s*\+)?\s*(?:-\s*\d+)?\s*years?(?:\s+of)?\s+(?:relevant|prior|work|industry|professional|related)?\s*experience\b/i,
        /experience\s*(?:of|:)?\s*(\d+)(?:\+|\s*\+)?\s*(?:-\s*\d+)?\s*years?/i,
        /minimum\s*(?:of)?\s*(\d+)(?:\+|\s*\+)?\s*years?(?:\s+of)?\s+experience/i,
        /(?:at least|minimum)\s*(\d+)(?:\+|\s*\+)?\s*years?/i,
        /(\d+)(?:\+|\s*\+)?\s*to\s*\d+\s*years?(?:\s+of)?\s+experience/i,
      ];

      // Create exclusion patterns - phrases that should NOT be counted as experience requirements
      const exclusionPatterns = [
        /company.*(?:founded|established|history|over)\s+\d+\s+years/i,
        /has\s+(?:been|served|operated|worked)(?:\s+as)?(?:\s+an?)?(?:\s+\w+)?\s+(?:for|over)\s+\d+\s+years/i,
        /(?:since|established in|founded in|for over|more than)\s+\d+\s+years/i,
        /history(?:\s+\w+){0,3}\s+\d+\s+years/i,
        /\d+\s+years\s+(?:in business|of history|of service)/i,
      ];

      // First check if the text contains exclusion patterns
      for (const excludePattern of exclusionPatterns) {
        if (excludePattern.test(text)) {
          // If found, remove or mark these sections before looking for experience requirements
          const match = excludePattern.exec(text);
          if (match) {
            // Create a temporary copy of text with the company history mention removed
            const tempText = text.replace(match[0], " [COMPANY_HISTORY] ");

            // Now search in the cleaned text
            for (const regex of expRegexPatterns) {
              const expMatch = tempText.match(regex);
              if (expMatch) {
                return expMatch[0];
              }
            }
          }
        }
      }

      // If no exclusions found, proceed with normal detection
      for (const regex of expRegexPatterns) {
        const match = text.match(regex);
        if (match) {
          // Additional check - if the experience is over 15 years, it's likely not a real requirement
          const years = parseInt(match[1]);
          if (years > 15) {
            continue; // Skip this match, likely a company description
          }
          return match[0];
        }
      }

      // Simplified pattern as fallback
      const simpleMatch = text.match(/(\d+)\+?\s*years?/i);
      if (simpleMatch) {
        const years = parseInt(simpleMatch[1]);
        // Only accept reasonable experience requirements (1-15 years)
        if (years > 0 && years <= 15) {
          return simpleMatch[0];
        }
      }
    } catch (error) {
      console.error("Error in extractExperienceRequirements:", error);
    }

    return "No specific experience mentioned";
  }

  // Display results in a window positioned at the right side of the screen
  function showResultsAtRightSide(
    jobText,
    citizenshipInfo,
    techStack,
    experience
  ) {
    // Remove any existing window
    if (analysisWindow) {
      analysisWindow.remove();
    }

    // Create results window
    analysisWindow = document.createElement("div");
    analysisWindow.style.position = "fixed";
    analysisWindow.style.top = "100px";
    analysisWindow.style.right = "20px";
    analysisWindow.style.width = "300px";
    analysisWindow.style.maxHeight = "80vh";
    analysisWindow.style.overflow = "auto";
    analysisWindow.style.backgroundColor = "white";
    analysisWindow.style.padding = "0";
    analysisWindow.style.borderRadius = "8px";
    analysisWindow.style.boxShadow = "0 0 20px rgba(0,0,0,0.15)";
    analysisWindow.style.zIndex = "2147483646";
    analysisWindow.style.fontFamily = "Arial, sans-serif";
    analysisWindow.style.fontSize = "14px";
    analysisWindow.style.border = "1px solid #ddd";
    analysisWindow.style.cursor = "default";

    // Build header with close button and make it draggable
    let content = `
            <div id="resultsHeader" style="background-color: #0a66c2; color: #ffffff; padding: 10px 15px; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: move;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: white;">Job Requirements</h3>
                <button id="closeResultsBtn" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 20px; line-height: 1;">×</button>
            </div>
            <div style="padding: 15px;">
        `;

    // Add platform indicator
    content += `
            <div style="margin-bottom: 15px; text-align: right; font-size: 11px; color: #777;">
                Analyzing: ${
                  currentPlatform === "seek" ? "SEEK" : "LinkedIn"
                } job post
            </div>
        `;

    // Citizenship section - using warning colors if found
    content += `
            <div style="margin-bottom: 20px; background-color: ${
              citizenshipInfo.found ? "#fff6f6" : "#f7fbf7"
            }; border-left: 4px solid ${
      citizenshipInfo.found ? "#e74c3c" : "#2ecc71"
    }; padding: 15px; border-radius: 4px;">
                <h3 style="margin-top: 0; margin-bottom: 10px; color: #333; font-size: 15px; font-weight: 600;">Citizenship/PR</h3>
                ${
                  citizenshipInfo.found
                    ? `<div>
                        <p style="margin: 0 0 10px 0; color: #e74c3c;"><span style="font-weight: bold;">${
                          citizenshipInfo.requirement
                        }</span> ${
                        citizenshipInfo.found
                          ? '<span style="color:#e74c3c; font-size:18px;">✘</span>'
                          : ""
                      }</p>
                        <p style="margin: 0; font-size: 12px; color: #666; font-style: italic;">"${
                          citizenshipInfo.context
                        }"</p>
                    </div>`
                    : `<p style="margin: 0; color: #2ecc71;">No specific requirements found <span style="font-size:18px;">✓</span></p>`
                }
            </div>
        `;

    // Technology stack section
    content += `
            <div style="margin-bottom: 20px; background-color: #f9f9f9; border-left: 4px solid #3498db; padding: 15px; border-radius: 4px;">
                <h3 style="margin-top: 0; margin-bottom: 10px; color: #333; font-size: 15px; font-weight: 600;">Tech Stack</h3>
                ${
                  techStack.length > 0
                    ? `<div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${techStack
                          .map(
                            (tech) =>
                              `<span style="background-color: #e8f0fe; color: #0a66c2; padding: 3px 8px; border-radius: 50px; font-size: 12px;">${tech}</span>`
                          )
                          .join("")}
                    </div>`
                    : `<p style="margin: 0; color: #555;">No specific technologies detected</p>`
                }
            </div>
        `;

    // Experience section
    content += `
            <div style="margin-bottom: 20px; background-color: #f9f9f9; border-left: 4px solid #f7b731; padding: 15px; border-radius: 4px;">
                <h3 style="margin-top: 0; margin-bottom: 10px; color: #333; font-size: 15px; font-weight: 600;">Experience</h3>
                <p style="margin: 0;">${experience}</p>
            </div>
        `;

    // View raw text button
    content += `
            <div style="text-align: center;">
                <button id="viewRawTextBtn" style="background-color: #f2f2f2; border: none; color: #555; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">View Raw Text</button>
            </div>
        `;

    content += `</div>`; // Close main padding div

    analysisWindow.innerHTML = content;
    document.body.appendChild(analysisWindow);

    // Add draggable functionality
    makeDraggable(analysisWindow);

    // Add minimize/expand functionality to make window collapsible
    addMinimizeButton(analysisWindow);

    // Add close button functionality
    document
      .getElementById("closeResultsBtn")
      .addEventListener("click", function () {
        analysisWindow.remove();
        analysisWindow = null;
      });

    // Add raw text view functionality
    document
      .getElementById("viewRawTextBtn")
      .addEventListener("click", function () {
        showRawText(jobText);
      });
  }

  // Make an element draggable
  function makeDraggable(element) {
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;
    const header = document.getElementById("resultsHeader");

    if (header) {
      // if header exists, add event listeners to it
      header.onmousedown = dragMouseDown;
    } else {
      // otherwise, add event listeners to the element itself
      element.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position
      element.style.top = element.offsetTop - pos2 + "px";
      element.style.left = element.offsetLeft - pos1 + "px";
      element.style.right = "auto"; // Reset right positioning when dragging
    }

    function closeDragElement() {
      // stop moving when mouse button is released
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // Add minimize button to make the window collapsible
  function addMinimizeButton(windowElement) {
    // Create minimize button - now positioned at top right
    const minButton = document.createElement("div");
    minButton.innerHTML = "−";
    minButton.style.position = "absolute";
    minButton.style.top = "10px";
    minButton.style.right = "40px";
    minButton.style.backgroundColor = "transparent";
    minButton.style.color = "white";
    minButton.style.width = "20px";
    minButton.style.height = "20px";
    minButton.style.display = "flex";
    minButton.style.alignItems = "center";
    minButton.style.justifyContent = "center";
    minButton.style.borderRadius = "50%";
    minButton.style.cursor = "pointer";
    minButton.style.zIndex = "2147483645";
    minButton.style.transition = "all 0.3s ease";

    // State tracking
    let isMinimized = false;
    const originalHeight = windowElement.style.height;
    const fullContent = windowElement.innerHTML;

    // Toggle functionality
    minButton.addEventListener("click", function () {
      if (isMinimized) {
        // Expand
        windowElement.style.height = originalHeight;
        windowElement.innerHTML = fullContent;
        this.innerHTML = "−";

        // Re-add drag functionality
        makeDraggable(windowElement);

        // Re-add event listeners that were lost when innerHTML was replaced
        document
          .getElementById("closeResultsBtn")
          .addEventListener("click", function () {
            windowElement.remove();
            analysisWindow = null;
          });

        document
          .getElementById("viewRawTextBtn")
          .addEventListener("click", function () {
            const jobText = extractJobText();
            showRawText(jobText);
          });

        // Re-add minimize button
        windowElement.appendChild(minButton);
      } else {
        // Minimize - just keep the header
        const header = document.getElementById("resultsHeader");
        const headerContent = header ? header.outerHTML : "";
        windowElement.innerHTML = headerContent;
        windowElement.style.height = "auto";
        this.innerHTML = "+";

        // Re-add close button functionality
        const closeBtn = document.getElementById("closeResultsBtn");
        if (closeBtn) {
          closeBtn.addEventListener("click", function () {
            windowElement.remove();
            analysisWindow = null;
          });
        }

        // Re-add drag functionality
        makeDraggable(windowElement);

        // Re-add minimize button
        windowElement.appendChild(minButton);
      }

      isMinimized = !isMinimized;
    });

    windowElement.appendChild(minButton);
  }

  // Show raw text in a modal
  function showRawText(text) {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.width = "700px";
    modal.style.maxHeight = "80vh";
    modal.style.backgroundColor = "white";
    modal.style.padding = "0";
    modal.style.borderRadius = "8px";
    modal.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
    modal.style.zIndex = "2147483647";
    modal.style.fontFamily = "Arial, sans-serif";

    modal.innerHTML = `
            <div style="background-color: #f2f2f2; padding: 15px 20px; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 16px; color: #333;">Raw Job Description</h3>
                <button id="closeRawTextBtn" style="background: transparent; color: #333; border: none; cursor: pointer; font-size: 20px; line-height: 1;">×</button>
            </div>
            <div style="padding: 20px; max-height: 60vh; overflow: auto;">
                <pre style="white-space: pre-wrap; font-family: monospace; font-size: 13px; margin: 0; color: #333; background-color: #f9f9f9; padding: 15px; border-radius: 4px;">${text
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")}</pre>
            </div>
            <div style="padding: 15px 20px; text-align: right; border-top: 1px solid #eee;">
                <button id="closeRawTextBtnBottom" style="background-color: #0a66c2; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
        `;

    document.body.appendChild(modal);

    document
      .getElementById("closeRawTextBtn")
      .addEventListener("click", function () {
        modal.remove();
      });

    document
      .getElementById("closeRawTextBtnBottom")
      .addEventListener("click", function () {
        modal.remove();
      });
  }

  // Start the script
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  // Also try on window load (for safety)
  window.addEventListener("load", initialize);

  // Start after a delay as a fallback
  setTimeout(initialize, 2000);
})();
