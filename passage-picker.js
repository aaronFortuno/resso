export function bindPassages(courseSelect, textSelect, passages, ui, onChange) {
  const courses = Object.entries(ui.courses).map(([grade, label]) => ({
    grade,
    label,
    texts: passages.filter(passage => passage.grade === Number(grade)),
  })).filter(course => course.texts.length);
  for (const { grade, label } of courses) courseSelect.add(new Option(label, grade));

  function updateOptions() {
    const course = courses.find(course => course.grade === courseSelect.value);
    textSelect.replaceChildren(...course.texts.map(({ title, id }) => new Option(title, id)));
  }

  updateOptions();
  courseSelect.addEventListener('change', () => {
    updateOptions();
    onChange();
  });
  textSelect.addEventListener('change', onChange);
  return () => passages.find(passage => passage.id === textSelect.value);
}
