-- Move "Get Involved" enrollment CTA into editable page body for committee pages
-- that previously kept it outside #page-body in the HTML shell.
-- Skips rows that already include the enrollment link (e.g. embedded-facilities).

UPDATE pages
SET body_html = COALESCE(body_html, '') || '
<section class="content-section bg-light">
    <div class="container">
        <div class="cta-content" style="text-align: center;">
            <h2>Get Involved</h2>
            <p>Click here to view your committee enrollment.</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="committee-enrollment.html" class="btn btn-primary">Committee Enrollment</a>
            </div>
            <br>
            <p>Interested in participating in this committee?</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="contact.html" class="btn btn-primary">Contact Us</a>
            </div>
        </div>
    </div>
</section>'
WHERE slug IN (
  'budget-committee',
  'technical-solutions-committee',
  'craig-rogers-award',
  'training'
)
AND body_html IS NOT NULL
AND trim(body_html) != ''
AND body_html NOT LIKE '%committee-enrollment.html%';

UPDATE pages
SET body_html = COALESCE(body_html, '') || '
<section class="content-section bg-light">
    <div class="container">
        <div class="cta-content" style="text-align: center;">
            <h2>Get Involved</h2>
            <p>Click here to view your committee enrollment.</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="committee-enrollment.html" class="btn btn-primary">Committee Enrollment</a>
            </div>
            <br>
            <p>Interested in participating in this program?</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="contact.html" class="btn btn-primary">Contact Us</a>
            </div>
        </div>
    </div>
</section>'
WHERE slug = '811-day'
AND body_html IS NOT NULL
AND trim(body_html) != ''
AND body_html NOT LIKE '%committee-enrollment.html%';

UPDATE pages
SET body_html = COALESCE(body_html, '') || '
<section class="content-section bg-light">
    <div class="container">
        <div class="cta-content" style="text-align: center;">
            <h2>Get Involved</h2>
            <p>Click here to view your committee enrollment.</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="committee-enrollment.html" class="btn btn-primary">Committee Enrollment</a>
            </div>
            <br>
            <p>Interested in participating in the operations committee? We''d love to hear from you.</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="contact.html" class="btn btn-primary">Contact Us</a>
            </div>
        </div>
    </div>
</section>'
WHERE slug = 'operations'
AND body_html IS NOT NULL
AND trim(body_html) != ''
AND body_html NOT LIKE '%committee-enrollment.html%';

UPDATE pages
SET body_html = COALESCE(body_html, '') || '
<section class="content-section bg-light">
    <div class="container">
        <div class="cta-content" style="text-align: center;">
            <h2>Get Involved</h2>
            <p>Click here to view your committee enrollment.</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="committee-enrollment.html" class="btn btn-primary">Committee Enrollment</a>
            </div>
            <br>
            <p>Interested in participating in or sponsoring the golf tournament?</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="contact.html" class="btn btn-primary">Contact Us</a>
            </div>
        </div>
    </div>
</section>'
WHERE slug = 'golf-tournament'
AND body_html IS NOT NULL
AND trim(body_html) != ''
AND body_html NOT LIKE '%committee-enrollment.html%';

UPDATE pages
SET body_html = COALESCE(body_html, '') || '
<section class="content-section bg-light">
    <div class="container">
        <div class="cta-content" style="text-align: center;">
            <h2>Get Involved</h2>
            <p>Click here to view your committee enrollment.</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="committee-enrollment.html" class="btn btn-primary">Committee Enrollment</a>
            </div>
            <br>
            <p>Interested in participating in or sponsoring this event?</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 3rem; flex-wrap: wrap;">
                <a href="contact.html" class="btn btn-primary">Contact Us</a>
            </div>
        </div>
    </div>
</section>'
WHERE slug IN ('silver-shovel-award', 'utility-locate-rodeo')
AND body_html IS NOT NULL
AND trim(body_html) != ''
AND body_html NOT LIKE '%committee-enrollment.html%';
