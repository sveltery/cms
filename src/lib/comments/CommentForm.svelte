<script lang="ts">
 import { submitCommentForm } from './form-submission.ts';
 let {collection,contentId,parentId=null,user,enabled=false,basePath='',turnstileSiteKey}:{collection:string;contentId:string;parentId?:string|null;user?:{name:string|null;email:string};enabled?:boolean;basePath?:string;turnstileSiteKey?:string}=$props();
 const endpoint=$derived(basePath+'/api/comments/'+encodeURIComponent(collection)+'/'+encodeURIComponent(contentId));
</script>
<svelte:head>{#if enabled&&turnstileSiteKey}<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>{/if}</svelte:head>
{#if enabled}<form id={`ec-comment-form-${parentId??'root'}`} class="ec-comment-form" aria-label="Post a comment" data-ec-comment-form data-endpoint={endpoint} data-user-name={user?.name??''} data-user-email={user?.email??''} onsubmit={submitCommentForm}>
 {#if user}<div class="ec-comment-user-info"><span class="ec-comment-user-name">{user.name}</span><span class="ec-comment-user-email">{user.email}</span></div>{:else}<div class="ec-comment-form-fields"><label class="ec-comment-form-field"><span>Name</span><input type="text" name="authorName" required maxlength="100"/></label><label class="ec-comment-form-field"><span>Email</span><input type="email" name="authorEmail" required/></label></div>{/if}
 <div aria-hidden="true" style="position:absolute;left:-9999px;top:-9999px;"><label>Don't fill this out<input type="text" name="website_url" tabindex="-1" autocomplete="off"/></label></div>
 <label class="ec-comment-form-field"><span>Comment</span><textarea name="body" required maxlength="5000" rows="4"></textarea></label>
 {#if parentId}<input type="hidden" name="parentId" value={parentId}/>{/if}
 {#if turnstileSiteKey}<div class="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="auto"></div>{/if}
 <button type="submit" class="ec-comment-form-submit">Post Comment</button><div class="ec-comment-form-status" role="status" aria-live="polite"></div>
</form>{/if}
<style>
	.ec-comment-form {
		--ec-form-gap: 0.75rem;
	}

	.ec-comment-form-fields {
		display: grid;
		gap: var(--ec-form-gap);
	}

	@media (min-width: 640px) {
		.ec-comment-form-fields {
			grid-template-columns: 1fr 1fr;
		}
	}

	.ec-comment-form-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: var(--ec-form-gap);
	}

	.ec-comment-form-field:first-child {
		margin-top: 0;
	}

	.ec-comment-form-fields .ec-comment-form-field {
		margin-top: 0;
	}

	.ec-comment-form-field input,
	.ec-comment-form-field textarea {
		padding: 0.5rem;
		border: 1px solid var(--ec-form-border, #d1d5db);
		border-radius: 0.25rem;
		font: inherit;
		background: var(--ec-form-bg, #fff);
		color: var(--ec-form-color, inherit);
	}

	:global(.dark) .ec-comment-form-field input,
	:global(.dark) .ec-comment-form-field textarea {
		--ec-form-bg: #1f2937;
		--ec-form-border: #4b5563;
		--ec-form-color: #f9fafb;
	}

	.ec-comment-user-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--ec-form-user-bg, #f3f4f6);
		border: 1px solid var(--ec-form-user-border, #d1d5db);
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	:global(.dark) .ec-comment-user-info {
		background: var(--ec-form-user-bg-dark, #374151);
	}

	.ec-comment-user-name {
		font-weight: 600;
	}

	.ec-comment-user-email {
		opacity: 0.7;
	}

	.ec-comment-user-email::before {
		content: "·";
		margin-right: 0.5rem;
	}

	.ec-comment-form-submit {
		margin-top: var(--ec-form-gap);
		padding: 0.5rem 1.5rem;
		border: none;
		border-radius: 0.25rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		background: var(--ec-form-submit-bg, #1f2937);
		color: var(--ec-form-submit-color, #fff);
	}

	.ec-comment-form-submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	:global(.ec-comment-form-status) {
		margin-top: var(--ec-form-gap);
		font-size: 0.875em;
	}

	:global(.ec-comment-form-status:empty) {
		display: none;
	}

	:global(.ec-comment-form-success) {
		color: var(--ec-form-success-color, #059669);
	}

	:global(.ec-comment-form-error) {
		color: var(--ec-form-error-color, #dc2626);
	}

</style>
