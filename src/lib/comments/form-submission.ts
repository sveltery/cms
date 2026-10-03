// Complete selected immutable Source CommentForm.astro submission callback body.
// EmDash MIT Cloudflare Inc.2026; native Svelte attaches it to its own form.
declare global { interface Window { turnstile?: { reset():void } } }
export async function submitCommentForm(e:Event) {
		const form = e.target;
		if (
			!(form instanceof HTMLFormElement) ||
			!form.hasAttribute("data-ec-comment-form")
		)
			return;
		e.preventDefault();

		const endpoint = form.dataset.endpoint;
		if (!endpoint) return;

		const submitBtn = form.querySelector<HTMLButtonElement>(
			".ec-comment-form-submit"
		);
		const statusEl = form.querySelector<HTMLElement>(".ec-comment-form-status");
		if (!submitBtn || !statusEl) return;

		submitBtn.disabled = true;
		submitBtn.textContent = "Submitting...";
		statusEl.textContent = "";
		statusEl.className = "ec-comment-form-status";

		const data = new FormData(form);
		const body: Record<string, string> = {};

		// Include user info from data attributes (for authenticated users)
		const userName = form.dataset.userName;
		const userEmail = form.dataset.userEmail;
		if (userName) body.authorName = userName;
		if (userEmail) body.authorEmail = userEmail;

		for (const [key, value] of data.entries()) {
			if (typeof value === "string") {
				body[key] = value;
			}
		}

		// Get Turnstile token if present
		const turnstileInput = form.querySelector<HTMLInputElement>(
			"[name='cf-turnstile-response']"
		);
		if (turnstileInput?.value) {
			body.turnstileToken = turnstileInput.value;
		}

		try {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-EmDash-Request": "1",
				},
				body: JSON.stringify(body),
			});

			const result = await res.json();

			if (res.ok) {
				statusEl.textContent = result.message || "Comment submitted!";
				statusEl.classList.add("ec-comment-form-success");
				// Reset form fields (but not disabled pre-filled fields)
				const textarea = form.querySelector<HTMLTextAreaElement>(
					"textarea[name='body']"
				);
				if (textarea) textarea.value = "";
			} else {
				statusEl.textContent =
					result.error?.message ||
					result.message ||
					"Failed to submit comment.";
				statusEl.classList.add("ec-comment-form-error");
			}
		} catch {
			statusEl.textContent = "Network error. Please try again.";
			statusEl.classList.add("ec-comment-form-error");
		} finally {
			// Reset Turnstile on success and failure alike (incl. network
			// errors) — tokens are single-use, so any retry needs a fresh
			// challenge
			if (typeof window.turnstile !== "undefined") {
				window.turnstile.reset();
			}
			submitBtn.disabled = false;
			submitBtn.textContent = "Post Comment";
		}
	}
