import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { prisma } from '../../db';
import { buildSolverInput } from '../../lib/utils';
import { z } from 'zod';

const solverResultSchema = z.object({
  status: z.number(),
  matchings: z.array(
    z.object({
      student_id: z.string(),
      topic_id: z.string(),
    }),
  ),
});

export async function solve(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const students = await prisma.student.findMany({
      select: {
        id: true,
        studentTopicPreferences: true,
        studentCourseCompletions: true,
        assignedTopic: true,
      },
    });
    const topics = await prisma.topic.findMany({
      select: {
        id: true,
        capacity: true,
        topicCoursePreferences: true,
        instructorId: true,
      },
    });
    const instructors = await prisma.instructor.findMany({
      select: {
        id: true,
        min: true,
        max: true,
      },
    });

    const studentsWithSpecialTopics = students.filter(
      (student) =>
        student.assignedTopic &&
        ['tdk', 'research', 'internship'].includes(student.assignedTopic?.type),
    );

    const studentsWithoutSpecialTopics = students.filter(
      (student) => studentsWithSpecialTopics.indexOf(student) === -1,
    );

    const instructorsWithCorrectedCapacity = instructors
      .map((instructor) => {
        const assignedStudents = studentsWithSpecialTopics.filter(
          (student) => student.assignedTopic?.instructorId === instructor.id,
        ).length;
        return {
          ...instructor,
          capacity: instructor.max - assignedStudents,
        };
      })
      .filter((instructor) => instructor.capacity > 0);

    const input = buildSolverInput(
      studentsWithoutSpecialTopics,
      topics,
      instructorsWithCorrectedCapacity,
    );

    if (!process.env.SOLVER_ENDPOINT) {
      throw new Error('SOLVER_ENDPOINT env variable not defined');
    }
    const res = await fetch(process.env.SOLVER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      context.error(await res.json());
      return {
        status: 500,
      };
    }

    const result = solverResultSchema.safeParse(await res.json());

    if (!result.success) {
      context.error(result.error);
      return {
        status: 500,
      };
    }

    await prisma.student.updateMany({
      data: {
        assignedTopicId: null,
      },
    });
    // await prisma.$transaction(
    //   result.data.matchings.map(({ student_id, topic_id }) => {
    //     return prisma.student.update({
    //       data: {
    //         assignedTopicId: topic_id,
    //       },
    //       where: {
    //         id: student_id,
    //       },
    //     });
    //   }),
    // );

    return {
      jsonBody: result.data,
    };
  } catch (error) {
    context.error(error);

    return {
      status: 500,
    };
  }
}
