package com.pag.app.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.pag.app.model.Student;

@Repository
public interface StudentRepository extends JpaRepository<Student, Long> {

    boolean existsByCedula(String cedula);

    boolean existsByEmail(String email);

    boolean existsByCedulaAndIdNot(String cedula, Long id);

    boolean existsByEmailAndIdNot(String email, Long id);
}
