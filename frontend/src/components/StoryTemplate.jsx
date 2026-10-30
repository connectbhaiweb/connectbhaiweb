import STORY_HTML from "@/lib/connectbhai/storyTemplate";

/* Inert <template>: the hero view clones its innerHTML. Static markup, so dangerouslySetInnerHTML is safe here. */
export default function StoryTemplate() {
  return <template id="tpl-story" dangerouslySetInnerHTML={{ __html: STORY_HTML }} />;
}
