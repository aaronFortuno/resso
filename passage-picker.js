export function bindPassages(courseSelect, textSelect, passages, ui, onChange) {
  const courses = Object.entries(ui.courses).map(([grade, label]) => ({
    grade,
    label,
    texts: passages.filter(passage => passage.grade === Number(grade)),
  })).filter(course => course.texts.length);
  courseSelect.add(new Option(ui.allCourses, ''));
  for (const { grade, label } of courses) courseSelect.add(new Option(label, grade));

  function updateOptions() {
    const previous = textSelect.value || passages[0].id;
    const grade = courseSelect.value;
    textSelect.replaceChildren();
    for (const course of courses) {
      if (grade && grade !== course.grade) continue;
      const options = course.texts.map(({ title, id }) => new Option(title, id));
      if (grade) {
        textSelect.append(...options);
      } else {
        const group = document.createElement('optgroup');
        group.label = course.label;
        group.append(...options);
        textSelect.append(group);
      }
    }
    if ([...textSelect.options].some(option => option.value === previous)) textSelect.value = previous;
  }

  updateOptions();
  courseSelect.addEventListener('change', () => {
    const previous = textSelect.value;
    updateOptions();
    if (textSelect.value !== previous) onChange();
  });
  textSelect.addEventListener('change', onChange);
  return () => passages.find(passage => passage.id === textSelect.value);
}
