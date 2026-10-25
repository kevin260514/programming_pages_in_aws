package com.pag.app.service;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pag.app.exception.DuplicateResourceException;
import com.pag.app.exception.ResourceNotFoundException;
import com.pag.app.model.Student;
import com.pag.app.repository.StudentRepository;

@Service
public class StudentService {

    private final StudentRepository repository;

    public StudentService(StudentRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<Student> findAll() {
        return repository.findAll(Sort.by("nombre").ascending());
    }

    @Transactional(readOnly = true)
    public Student findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No existe el estudiante con id " + id));
    }

    @Transactional
    public Student create(Student student) {
        if (repository.existsByCedula(student.getCedula())) {
            throw new DuplicateResourceException("Ya existe un estudiante con esa cédula");
        }
        if (repository.existsByEmail(student.getEmail())) {
            throw new DuplicateResourceException("Ya existe un estudiante con ese email");
        }
        student.setId(null);
        return repository.save(student);
    }

    @Transactional
    public Student update(Long id, Student data) {
        Student existing = findById(id);
        if (repository.existsByCedulaAndIdNot(data.getCedula(), id)) {
            throw new DuplicateResourceException("Ya existe otro estudiante con esa cédula");
        }
        if (repository.existsByEmailAndIdNot(data.getEmail(), id)) {
            throw new DuplicateResourceException("Ya existe otro estudiante con ese email");
        }
        existing.setCedula(data.getCedula());
        existing.setNombre(data.getNombre());
        existing.setEmail(data.getEmail());
        existing.setTelefono(data.getTelefono());
        existing.setDireccion(data.getDireccion());
        existing.setFechaNacimiento(data.getFechaNacimiento());
        return repository.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        Student existing = findById(id);
        repository.delete(existing);
    }
}
