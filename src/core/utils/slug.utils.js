import slugify from "slugify";

//Convert any string to SEO-friendly slug

const toSlug = (text) => {
  const options = { lower: true, strict: true, trim: true };
  return slugify(text, options);
};

export default toSlug;
