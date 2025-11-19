document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Helper to get initials from an email
  function getInitials(email) {
    if (!email) return "";
    const local = email.split("@")[0] || "";
    const parts = local.split(/[.\-_]/).filter(Boolean);
    let initials = "";
    if (parts.length === 0) {
      initials = (local[0] || "").toUpperCase();
    } else {
      initials = parts.slice(0, 2).map(p => (p[0] || "").toUpperCase()).join("");
    }
    return initials || "?";
  }

  // Build participants section HTML for an activity
  function buildParticipantsSection(details, name) {
    let html = '<div class="participants-section"><h5>Participants</h5>';
    if (!details.participants || details.participants.length === 0) {
      html += '<p class="no-participants">No participants yet</p>';
    } else {
      html += '<div class="participants-list">';
      details.participants.forEach((email) => {
        const initials = getInitials(email);
        html += `
          <div class="participant-item">
            <span class="participant-avatar" aria-hidden="true">${initials}</span>
            <span class="participant-email">${email}</span>
            <span class="delete-participant" title="Remove participant" data-activity="${name}" data-email="${email}" aria-label="Delete participant">&#x2716;</span>
          </div>
        `;
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  // Attach delete listeners for delete icons within given container
  function addDeleteListeners(container) {
    container.querySelectorAll('.delete-participant').forEach(icon => {
      // Avoid attaching multiple times
      if (icon._hasListener) return;
      icon._hasListener = true;
      icon.addEventListener('click', async () => {
        const activity = icon.getAttribute('data-activity');
        const email = icon.getAttribute('data-email');
        if (!activity || !email) return;
        if (!confirm(`Remove ${email} from ${activity}?`)) return;
        try {
          const response = await fetch(`/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`, {
            method: 'POST',
          });
          const result = await response.json();
          if (response.ok) {
            messageDiv.textContent = result.message;
            messageDiv.className = "success";
            // Refresh only the affected activity
            try {
              const resp = await fetch('/activities');
              const activities = await resp.json();
              if (activities[activity]) {
                updateActivityInDOM(activity, activities[activity]);
              } else {
                fetchActivities();
              }
            } catch (err) {
              console.error('Failed to refresh activities after unregister:', err);
            }
          } else {
            messageDiv.textContent = result.detail || "An error occurred";
            messageDiv.className = "error";
          }
          messageDiv.classList.remove("hidden");
          setTimeout(() => {
            messageDiv.classList.add("hidden");
          }, 5000);
        } catch (error) {
          messageDiv.textContent = "Failed to unregister participant. Please try again.";
          messageDiv.className = "error";
          messageDiv.classList.remove("hidden");
          setTimeout(() => {
            messageDiv.classList.add("hidden");
          }, 5000);
        }
      });
    });
  }

  // Update a single activity card in the DOM
  function updateActivityInDOM(activityName, details) {
    const cards = Array.from(activitiesList.children || []);
    const card = cards.find(c => c.getAttribute('data-activity') === activityName);
    if (!card) return; // nothing to update
    const spotsLeft = details.max_participants - details.participants.length;
    const availability = card.querySelector('.activity-availability');
    if (availability) {
      availability.innerHTML = `<strong>Availability:</strong> ${spotsLeft} spots left`;
    }
    const participantsSection = card.querySelector('.participants-section');
    if (participantsSection) {
      participantsSection.outerHTML = buildParticipantsSection(details, activityName);
      // Re-attach delete listeners for this card
      const updatedCard = cards.find(c => c.getAttribute('data-activity') === activityName);
      if (updatedCard) addDeleteListeners(updatedCard);
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Reset activity select options (keep placeholder)
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHtml = buildParticipantsSection(details, name);

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p class="activity-availability"><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${participantsHtml}
        `;
        activityCard.setAttribute('data-activity', name);

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Attach delete listeners for all rendered cards
      addDeleteListeners(activitiesList);
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // Refresh only the affected activity
        try {
          const resp = await fetch('/activities');
          const activities = await resp.json();
          if (activities[activity]) {
            updateActivityInDOM(activity, activities[activity]);
          } else {
            fetchActivities();
          }
        } catch (err) {
          console.error('Failed to refresh activity after signup:', err);
        }
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
