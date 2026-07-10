use crate::{Brush, Point};
use serde::{Deserialize, Serialize};

/// A stroke instruction.
#[derive(Default, Serialize, Deserialize, Debug, Clone)]
pub struct Stroke {
    points: Vec<Point>,
    brush: Brush,
    #[serde(skip_serializing_if = "Option::is_none")]
    selection: Option<Vec<Point>>,
}

impl Stroke {
    pub fn new(points: Vec<Point>, brush: Brush, selection: Option<Vec<Point>>) -> Self {
        Stroke { points, brush, selection }
    }

    pub fn len(&self) -> usize {
        self.points.len()
    }

    pub fn is_empty(&self) -> bool {
        self.points.len() == 0
    }

    /// Changes the stroke's brush.
    pub fn set_brush(&mut self, brush: Brush) {
        self.brush = brush;
    }

    /// Gets the stroke's brush.
    pub fn brush(&self) -> Brush {
        self.brush.clone()
    }

    /// Adds a new point to the stroke.
    pub fn add_point(&mut self, point: Point) {
        self.points.push(point);
    }

    /// Sets the stroke's selection polygon.
    pub fn set_selection(&mut self, selection: Vec<Point>) {
        self.selection = Some(selection);
    }
}
