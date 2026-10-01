<section aria-labelledby="draft-heading">
  <h2 id="draft-heading">Start with a draft</h2>
  <p>This editor preview will connect to content storage after authentication and persistence are configured.</p>
  <fieldset disabled>
    <label for="draft-title">Title</label>
    <input id="draft-title" placeholder="Give your story a title" />
    <label for="draft-body">Content</label>
    <textarea id="draft-body" rows="6" placeholder="Write something worth sharing"></textarea>
    <button type="button">Save draft</button>
  </fieldset>
</section>

<style>
  section { padding: 28px; background: white; border: 1px solid #dfe3e9; border-radius: 12px; }
  h2 { margin-top: 0; font-size: 20px; }
  p { color: #526079; line-height: 1.6; }
  fieldset { border: 0; padding: 0; display: grid; gap: 12px; }
  label { font-weight: 600; }
  input, textarea { font: inherit; padding: 12px; border: 1px solid #aab4c3; border-radius: 6px; background: #f5f6f8; }
  button { justify-self: start; font: inherit; padding: 10px 18px; border: 0; border-radius: 6px; background: #dce1ee; color: #526079; }
</style>
