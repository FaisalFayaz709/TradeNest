-- Pass 04: prevent the same S3 object being registered multiple times.
-- Before applying to an existing installation, resolve any historical duplicate keys.
CREATE UNIQUE INDEX "product_images_object_key_key" ON "product_images"("object_key");
CREATE UNIQUE INDEX "dispute_evidence_object_key_key" ON "dispute_evidence"("object_key");
