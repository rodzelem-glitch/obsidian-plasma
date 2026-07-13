(function() {
    const container = document.getElementById('tektrakker-blog-widget');
    if (!container) {
        console.error("TekTrakker Blog Widget: Container #tektrakker-blog-widget not found.");
        return;
    }

    const orgId = container.getAttribute('data-org');
    if (!orgId) {
        console.error("TekTrakker Blog Widget: Missing data-org attribute on container.");
        container.innerHTML = '<p style="color:red;">Error: Missing Organization ID for Blog Widget.</p>';
        return;
    }

    // Default styles for the widget
    const styles = `
        .tt-blog-widget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; }
        .tt-blog-post { margin-bottom: 2rem; padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .tt-blog-title { margin-top: 0; margin-bottom: 0.5rem; color: #111827; font-size: 1.5rem; line-height: 2rem; font-weight: 700; }
        .tt-blog-meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 1rem; }
        .tt-blog-content { color: #374151; line-height: 1.6; }
        .tt-blog-content h1, .tt-blog-content h2, .tt-blog-content h3 { color: #111827; margin-top: 1.5rem; margin-bottom: 0.75rem; font-weight: 600; }
        .tt-blog-content p { margin-bottom: 1rem; }
        .tt-blog-content ul, .tt-blog-content ol { margin-bottom: 1rem; padding-left: 1.5rem; }
        .tt-blog-loading { text-align: center; padding: 2rem; color: #6b7280; }
        .tt-blog-empty { text-align: center; padding: 2rem; color: #6b7280; background: #f9fafb; border-radius: 8px; }
        .tt-blog-footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; font-size: 0.875rem; color: #9ca3af; }
        .tt-blog-footer a { color: #0284c7; text-decoration: none; }
        .tt-blog-footer a:hover { text-decoration: underline; }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    container.innerHTML = '<div class="tt-blog-loading">Loading articles...</div>';

    const projectId = "tektrakker";
    const firestoreUrl = \`https://firestore.googleapis.com/v1/projects/\${projectId}/databases/(default)/documents/organizations/\${orgId}/blogPosts\`;

    fetch(firestoreUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to load blog posts");
            }
            return response.json();
        })
        .then(data => {
            if (!data.documents || data.documents.length === 0) {
                container.innerHTML = '<div class="tt-blog-empty">No articles published yet.</div>';
                return;
            }

            // Parse Firestore document format
            let posts = data.documents.map(doc => {
                const fields = doc.fields || {};
                return {
                    id: doc.name.split('/').pop(),
                    title: fields.title ? fields.title.stringValue : 'Untitled',
                    content: fields.content ? fields.content.stringValue : '',
                    published: fields.published ? fields.published.booleanValue : false,
                    createdAt: fields.createdAt ? fields.createdAt.stringValue : null,
                    slug: fields.slug ? fields.slug.stringValue : ''
                };
            });

            // Filter out unpublished posts and sort by date descending
            posts = posts.filter(post => post.published);
            posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            if (posts.length === 0) {
                container.innerHTML = '<div class="tt-blog-empty">No articles published yet.</div>';
                return;
            }

            let html = '<div class="tt-blog-widget">';
            
            posts.forEach(post => {
                const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
                const formattedDate = post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, dateOptions) : '';
                
                html += \`
                    <article class="tt-blog-post">
                        <h2 class="tt-blog-title">\${post.title}</h2>
                        <div class="tt-blog-meta">\${formattedDate}</div>
                        <div class="tt-blog-content">
                            \${post.content}
                        </div>
                    </article>
                \`;
            });

            html += \`
                <div class="tt-blog-footer">
                    Powered by <a href="https://tektrakker.com" target="_blank" rel="noopener noreferrer">TekTrakker Blog Manager</a>
                </div>
            </div>\`;

            container.innerHTML = html;
        })
        .catch(err => {
            console.error("TekTrakker Blog Widget Error:", err);
            container.innerHTML = '<div class="tt-blog-empty" style="color:#ef4444;">Unable to load blog posts at this time.</div>';
        });
})();
